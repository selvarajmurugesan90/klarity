package k8s

import (
	"context"
	"fmt"
	"os"
	"sync"

	"github.com/sirupsen/logrus"
	apiextensionsclient "k8s.io/apiextensions-apiserver/pkg/client/clientset/clientset"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	metricsv1beta1 "k8s.io/metrics/pkg/client/clientset/versioned"
)

// APIResource describes a discovered Kubernetes API resource
type APIResource struct {
	Group      string   `json:"group"`
	Version    string   `json:"version"`
	Resource   string   `json:"resource"`
	Kind       string   `json:"kind"`
	Namespaced bool     `json:"namespaced"`
	Verbs      []string `json:"verbs"`
}

// Client wraps all Kubernetes clients for a single cluster
type Client struct {
	Clientset       kubernetes.Interface
	DynamicClient   dynamic.Interface
	DiscoveryClient discovery.DiscoveryInterface
	MetricsClient   metricsv1beta1.Interface
	APIExtClient    apiextensionsclient.Interface
	RestConfig      *rest.Config
	ClusterName     string
	log             *logrus.Logger

	mu           sync.RWMutex
	apiResources []APIResource
}

// Manager holds multiple cluster clients
type Manager struct {
	mu       sync.RWMutex
	clusters map[string]*Client
	current  string
	log      *logrus.Logger
}

func NewManager(log *logrus.Logger) *Manager {
	return &Manager{clusters: make(map[string]*Client), log: log}
}

// LoadInCluster loads the in-cluster config (when running inside a pod)
func (m *Manager) LoadInCluster() error {
	cfg, err := rest.InClusterConfig()
	if err != nil {
		return fmt.Errorf("in-cluster config: %w", err)
	}
	client, err := newClient(cfg, "in-cluster", m.log)
	if err != nil {
		return err
	}
	m.mu.Lock()
	m.clusters["in-cluster"] = client
	m.current = "in-cluster"
	m.mu.Unlock()
	return nil
}

// LoadKubeconfig loads from kubeconfig file, adding all contexts as clusters
func (m *Manager) LoadKubeconfig(kubeconfigPath string) error {
	if kubeconfigPath == "" {
		if home, err := os.UserHomeDir(); err == nil {
			kubeconfigPath = home + "/.kube/config"
		}
	}
	rules := clientcmd.NewDefaultClientConfigLoadingRules()
	rules.ExplicitPath = kubeconfigPath
	loader := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(rules, &clientcmd.ConfigOverrides{})
	rawConfig, err := loader.RawConfig()
	if err != nil {
		return fmt.Errorf("load kubeconfig: %w", err)
	}

	for contextName := range rawConfig.Contexts {
		override := &clientcmd.ConfigOverrides{CurrentContext: contextName}
		cfg, err := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(rules, override).ClientConfig()
		if err != nil {
			m.log.Warnf("skipping context %s: %v", contextName, err)
			continue
		}
		client, err := newClient(cfg, contextName, m.log)
		if err != nil {
			m.log.Warnf("failed to create client for context %s: %v", contextName, err)
			continue
		}
		m.mu.Lock()
		m.clusters[contextName] = client
		if m.current == "" {
			m.current = contextName
		}
		m.mu.Unlock()
	}
	if len(m.clusters) == 0 {
		return fmt.Errorf("no valid contexts found in kubeconfig")
	}
	return nil
}

// Auto detects in-cluster first, falls back to kubeconfig
func (m *Manager) Auto(kubeconfigPath string) error {
	if err := m.LoadInCluster(); err == nil {
		m.log.Info("Using in-cluster Kubernetes configuration")
		return nil
	}
	m.log.Info("Falling back to kubeconfig")
	return m.LoadKubeconfig(kubeconfigPath)
}

func (m *Manager) Current() (*Client, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	c, ok := m.clusters[m.current]
	if !ok {
		return nil, fmt.Errorf("no current cluster configured")
	}
	return c, nil
}

func (m *Manager) Get(name string) (*Client, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	c, ok := m.clusters[name]
	if !ok {
		return nil, fmt.Errorf("cluster %q not found", name)
	}
	return c, nil
}

func (m *Manager) List() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	names := make([]string, 0, len(m.clusters))
	for k := range m.clusters {
		names = append(names, k)
	}
	return names
}

func (m *Manager) Switch(name string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.clusters[name]; !ok {
		return fmt.Errorf("cluster %q not found", name)
	}
	m.current = name
	return nil
}

func (m *Manager) CurrentName() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.current
}

func newClient(cfg *rest.Config, name string, log *logrus.Logger) (*Client, error) {
	cfg = rest.CopyConfig(cfg)
	cfg.QPS = 100
	cfg.Burst = 200

	cs, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("kubernetes clientset: %w", err)
	}
	dyn, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("dynamic client: %w", err)
	}

	mc, _ := metricsv1beta1.NewForConfig(cfg)
	aec, _ := apiextensionsclient.NewForConfig(cfg)

	c := &Client{
		Clientset:       cs,
		DynamicClient:   dyn,
		DiscoveryClient: cs.Discovery(),
		MetricsClient:   mc,
		APIExtClient:    aec,
		RestConfig:      cfg,
		ClusterName:     name,
		log:             log,
	}

	if err := c.DiscoverResources(); err != nil {
		log.Warnf("initial resource discovery failed: %v", err)
	}
	return c, nil
}

// DiscoverResources calls the Kubernetes discovery API to enumerate all resources
func (c *Client) DiscoverResources() error {
	lists, err := c.DiscoveryClient.ServerPreferredResources()
	if err != nil && lists == nil {
		return fmt.Errorf("discovery: %w", err)
	}
	if err != nil {
		c.log.Warnf("partial resource discovery: %v", err)
	}

	var resources []APIResource
	for _, list := range lists {
		gv, err := schema.ParseGroupVersion(list.GroupVersion)
		if err != nil {
			continue
		}
		for _, r := range list.APIResources {
			if r.Name == "" {
				continue
			}
			resources = append(resources, APIResource{
				Group:      gv.Group,
				Version:    gv.Version,
				Resource:   r.Name,
				Kind:       r.Kind,
				Namespaced: r.Namespaced,
				Verbs:      r.Verbs,
			})
		}
	}

	c.mu.Lock()
	c.apiResources = resources
	c.mu.Unlock()
	c.log.Infof("Discovered %d API resources from cluster %s", len(resources), c.ClusterName)
	return nil
}

func (c *Client) GetAPIResources() []APIResource {
	c.mu.RLock()
	defer c.mu.RUnlock()
	out := make([]APIResource, len(c.apiResources))
	copy(out, c.apiResources)
	return out
}

func (c *Client) GetServerVersion() (string, error) {
	v, err := c.DiscoveryClient.ServerVersion()
	if err != nil {
		return "", err
	}
	return v.GitVersion, nil
}

func (c *Client) ServerGroups() (*metav1.APIGroupList, error) {
	return c.DiscoveryClient.ServerGroups()
}

func (c *Client) MetricsAvailable(ctx context.Context) bool {
	if c.MetricsClient == nil {
		return false
	}
	_, err := c.MetricsClient.MetricsV1beta1().NodeMetricses().List(ctx, metav1.ListOptions{Limit: 1})
	return err == nil
}
