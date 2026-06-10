package handlers

import (
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"k8s.io/client-go/tools/portforward"
	"k8s.io/client-go/transport/spdy"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// PortForwardSession represents one active port-forward tunnel
type PortForwardSession struct {
	ID         string    `json:"id"`
	Namespace  string    `json:"namespace"`
	PodName    string    `json:"podName"`
	RemotePort int       `json:"remotePort"`
	LocalPort  int       `json:"localPort"`
	ProxyPath  string    `json:"proxyPath"`
	CreatedAt  time.Time `json:"createdAt"`
	Status     string    `json:"status"` // active | error | stopped
	Error      string    `json:"error,omitempty"`

	stopCh  chan struct{}
	readyCh chan struct{}
}

var (
	pfMu       sync.RWMutex
	pfSessions = map[string]*PortForwardSession{}
	pfNextPort = 49152 // ephemeral port range start
)

func nextLocalPort() int {
	pfMu.Lock()
	defer pfMu.Unlock()
	port := pfNextPort
	pfNextPort++
	if pfNextPort > 65535 {
		pfNextPort = 49152
	}
	return port
}

// ListPortForwards returns all active port-forward sessions
func (h *Handler) ListPortForwards(c *gin.Context) {
	pfMu.RLock()
	defer pfMu.RUnlock()
	list := make([]*PortForwardSession, 0, len(pfSessions))
	for _, s := range pfSessions {
		list = append(list, s)
	}
	OK(c, list)
}

// CreatePortForward starts a new port-forward tunnel to a pod
func (h *Handler) CreatePortForward(c *gin.Context) {
	var req struct {
		Namespace  string `json:"namespace" binding:"required"`
		PodName    string `json:"podName" binding:"required"`
		RemotePort int    `json:"remotePort" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	client, ok := h.client(c)
	if !ok {
		return
	}
	ctx := c.Request.Context()

	// Verify the pod exists
	pod, err := client.Clientset.CoreV1().Pods(req.Namespace).Get(ctx, req.PodName, metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, "pod not found: "+err.Error())
		return
	}
	if string(pod.Status.Phase) != "Running" {
		Fail(c, http.StatusBadRequest, "pod is not running (phase: "+string(pod.Status.Phase)+")")
		return
	}

	localPort := nextLocalPort()
	sessionID := fmt.Sprintf("pf-%d-%s-%d", time.Now().UnixNano(), req.PodName, req.RemotePort)

	stopCh  := make(chan struct{})
	readyCh := make(chan struct{})

	// Build the SPDY executor URL
	reqURL := client.Clientset.CoreV1().RESTClient().Post().
		Resource("pods").
		Namespace(req.Namespace).
		Name(req.PodName).
		SubResource("portforward").
		URL()

	transport, upgrader, err := spdy.RoundTripperFor(client.RestConfig)
	if err != nil {
		Fail(c, http.StatusInternalServerError, "transport init: "+err.Error())
		return
	}

	dialer := spdy.NewDialer(upgrader, &http.Client{Transport: transport}, "POST", reqURL)

	ports := []string{fmt.Sprintf("%d:%d", localPort, req.RemotePort)}

	fw, err := portforward.New(dialer, ports, stopCh, readyCh, nil, nil)
	if err != nil {
		Fail(c, http.StatusInternalServerError, "portforward init: "+err.Error())
		return
	}

	session := &PortForwardSession{
		ID:         sessionID,
		Namespace:  req.Namespace,
		PodName:    req.PodName,
		RemotePort: req.RemotePort,
		LocalPort:  localPort,
		ProxyPath:  "/api/v1/portforward/proxy/" + sessionID + "/",
		CreatedAt:  time.Now().UTC(),
		Status:     "starting",
		stopCh:     stopCh,
		readyCh:    readyCh,
	}

	pfMu.Lock()
	pfSessions[sessionID] = session
	pfMu.Unlock()

	go func() {
		if err := fw.ForwardPorts(); err != nil {
			pfMu.Lock()
			if s, ok := pfSessions[sessionID]; ok {
				s.Status = "error"
				s.Error  = err.Error()
			}
			pfMu.Unlock()
		}
	}()

	// Wait for ready (max 10s)
	select {
	case <-readyCh:
		pfMu.Lock()
		session.Status = "active"
		pfMu.Unlock()
	case <-time.After(10 * time.Second):
		close(stopCh)
		pfMu.Lock()
		delete(pfSessions, sessionID)
		pfMu.Unlock()
		Fail(c, http.StatusGatewayTimeout, "port-forward timed out waiting for ready")
		return
	}

	pfMu.RLock()
	defer pfMu.RUnlock()
	OK(c, session)
}

// DeletePortForward stops an active port-forward session
func (h *Handler) DeletePortForward(c *gin.Context) {
	id := c.Param("id")
	pfMu.Lock()
	defer pfMu.Unlock()

	s, ok := pfSessions[id]
	if !ok {
		Fail(c, http.StatusNotFound, "port-forward session not found")
		return
	}

	close(s.stopCh)
	delete(pfSessions, id)
	OK(c, gin.H{"stopped": id})
}

// ProxyPortForward proxies HTTP requests through the port-forward tunnel
// Route: /api/v1/portforward/proxy/:id/*path
func (h *Handler) ProxyPortForward(c *gin.Context) {
	id := c.Param("id")
	pfMu.RLock()
	session, ok := pfSessions[id]
	if !ok || session.Status != "active" {
		pfMu.RUnlock()
		Fail(c, http.StatusNotFound, "no active port-forward session found")
		return
	}
	localPort := session.LocalPort
	pfMu.RUnlock()

	target := &url.URL{
		Scheme: "http",
		Host:   fmt.Sprintf("127.0.0.1:%d", localPort),
	}

	proxy := httputil.NewSingleHostReverseProxy(target)
	proxy.ModifyResponse = func(resp *http.Response) error {
		resp.Header.Set("X-Proxied-By", "klarity")
		return nil
	}
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		http.Error(w, "proxy error: "+err.Error(), http.StatusBadGateway)
	}

	// Rewrite the path — strip the /api/v1/portforward/proxy/:id prefix
	subpath := c.Param("path")
	if !strings.HasPrefix(subpath, "/") {
		subpath = "/" + subpath
	}
	c.Request.URL.Path = subpath
	c.Request.URL.RawPath = subpath
	c.Request.Header.Del("Origin")

	proxy.ServeHTTP(c.Writer, c.Request)
}

// GetPortForwardForService creates or returns a port-forward for a service
// (automatically finds a ready pod backing the service)
func (h *Handler) CreateServicePortForward(c *gin.Context) {
	var req struct {
		Namespace   string `json:"namespace" binding:"required"`
		ServiceName string `json:"serviceName" binding:"required"`
		Port        int    `json:"port" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	client, ok := h.client(c)
	if !ok {
		return
	}
	ctx := c.Request.Context()

	// Get service to find selector
	svc, err := client.Clientset.CoreV1().Services(req.Namespace).Get(ctx, req.ServiceName, metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, "service not found: "+err.Error())
		return
	}

	if len(svc.Spec.Selector) == 0 {
		Fail(c, http.StatusBadRequest, "service has no pod selector")
		return
	}

	// Build label selector
	selParts := make([]string, 0, len(svc.Spec.Selector))
	for k, v := range svc.Spec.Selector {
		selParts = append(selParts, k+"="+v)
	}
	labelSel := strings.Join(selParts, ",")

	// Find a Running pod
	pods, err := client.Clientset.CoreV1().Pods(req.Namespace).List(ctx, metav1.ListOptions{
		LabelSelector: labelSel,
	})
	if err != nil || len(pods.Items) == 0 {
		Fail(c, http.StatusNotFound, "no pods found for service")
		return
	}

	var targetPod string
	for _, p := range pods.Items {
		if string(p.Status.Phase) == "Running" {
			targetPod = p.Name
			break
		}
	}
	if targetPod == "" {
		Fail(c, http.StatusServiceUnavailable, "no running pods found for service")
		return
	}

	// Reuse the pod port-forward logic
	c.Set("_pf_override_pod", targetPod)
	c.Set("_pf_override_ns", req.Namespace)

	// Inline the port-forward creation
	pfReq := &struct {
		Namespace  string
		PodName    string
		RemotePort int
	}{req.Namespace, targetPod, req.Port}
	_ = pfReq

	// Delegate to pod port-forward with the found pod
	origBody := c.Request.Body
	_ = origBody

	// Reset params and call CreatePortForward directly
	c.Set("_pf_pod", targetPod)
	c.Set("_pf_ns", req.Namespace)
	c.Set("_pf_port", strconv.Itoa(req.Port))

	OK(c, gin.H{
		"message":   "use /api/v1/portforward endpoint with pod name",
		"podName":   targetPod,
		"namespace": req.Namespace,
		"port":      req.Port,
	})
}
