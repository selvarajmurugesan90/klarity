package handlers

import (
	"net/http"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// SearchResult represents a single matched resource
type SearchResult struct {
	Kind        string            `json:"kind"`
	APIVersion  string            `json:"apiVersion"`
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace"`
	Labels      map[string]string `json:"labels,omitempty"`
	Age         string            `json:"age"`
	Description string            `json:"description,omitempty"`
	NavPath     string            `json:"navPath"` // frontend route to navigate to
}

// GlobalSearch searches across all major resource types concurrently
func (h *Handler) GlobalSearch(c *gin.Context) {
	query := strings.TrimSpace(c.Query("q"))
	if len(query) < 2 {
		Fail(c, http.StatusBadRequest, "query must be at least 2 characters")
		return
	}
	ns := c.DefaultQuery("namespace", "")
	limitPer := 10 // max results per resource type

	client, ok := h.client(c)
	if !ok {
		return
	}
	ctx := c.Request.Context()

	targets := []struct {
		kind   string
		navFmt string
		fetch  func() ([]SearchResult, error)
	}{
		{
			kind: "Pod", navFmt: "/pods/%s/%s",
			fetch: func() ([]SearchResult, error) {
				list, err := client.Clientset.CoreV1().Pods(ns).List(ctx, metav1.ListOptions{Limit: 500})
				if err != nil {
					return nil, err
				}
				var out []SearchResult
				for _, item := range list.Items {
					if !matchQ(item.Name, item.Namespace, query) {
						continue
					}
					out = append(out, SearchResult{
						Kind: "Pod", APIVersion: "v1",
						Name: item.Name, Namespace: item.Namespace,
						Labels:  item.Labels,
						Age:     formatAgeTime(item.CreationTimestamp.Time),
						NavPath: "/pods/" + item.Namespace + "/" + item.Name,
					})
					if len(out) >= limitPer {
						break
					}
				}
				return out, nil
			},
		},
		{
			kind: "Deployment", navFmt: "/deployments/%s/%s",
			fetch: func() ([]SearchResult, error) {
				list, err := client.Clientset.AppsV1().Deployments(ns).List(ctx, metav1.ListOptions{Limit: 500})
				if err != nil {
					return nil, err
				}
				var out []SearchResult
				for _, item := range list.Items {
					if !matchQ(item.Name, item.Namespace, query) {
						continue
					}
					out = append(out, SearchResult{
						Kind: "Deployment", APIVersion: "apps/v1",
						Name: item.Name, Namespace: item.Namespace,
						Labels:  item.Labels,
						Age:     formatAgeTime(item.CreationTimestamp.Time),
						NavPath: "/deployments/" + item.Namespace + "/" + item.Name,
					})
					if len(out) >= limitPer {
						break
					}
				}
				return out, nil
			},
		},
		{
			kind: "Service",
			fetch: func() ([]SearchResult, error) {
				list, err := client.Clientset.CoreV1().Services(ns).List(ctx, metav1.ListOptions{Limit: 500})
				if err != nil {
					return nil, err
				}
				var out []SearchResult
				for _, item := range list.Items {
					if !matchQ(item.Name, item.Namespace, query) {
						continue
					}
					out = append(out, SearchResult{
						Kind: "Service", APIVersion: "v1",
						Name: item.Name, Namespace: item.Namespace,
						Age:     formatAgeTime(item.CreationTimestamp.Time),
						NavPath: "/services",
					})
					if len(out) >= limitPer {
						break
					}
				}
				return out, nil
			},
		},
		{
			kind: "ConfigMap",
			fetch: func() ([]SearchResult, error) {
				list, err := client.Clientset.CoreV1().ConfigMaps(ns).List(ctx, metav1.ListOptions{Limit: 500})
				if err != nil {
					return nil, err
				}
				var out []SearchResult
				for _, item := range list.Items {
					if !matchQ(item.Name, item.Namespace, query) {
						continue
					}
					out = append(out, SearchResult{
						Kind: "ConfigMap", APIVersion: "v1",
						Name: item.Name, Namespace: item.Namespace,
						Age:     formatAgeTime(item.CreationTimestamp.Time),
						NavPath: "/configmaps",
					})
					if len(out) >= limitPer {
						break
					}
				}
				return out, nil
			},
		},
		{
			kind: "Secret",
			fetch: func() ([]SearchResult, error) {
				list, err := client.Clientset.CoreV1().Secrets(ns).List(ctx, metav1.ListOptions{Limit: 500})
				if err != nil {
					return nil, err
				}
				var out []SearchResult
				for _, item := range list.Items {
					if !matchQ(item.Name, item.Namespace, query) {
						continue
					}
					out = append(out, SearchResult{
						Kind: "Secret", APIVersion: "v1",
						Name: item.Name, Namespace: item.Namespace,
						Age:     formatAgeTime(item.CreationTimestamp.Time),
						NavPath: "/secrets",
					})
					if len(out) >= limitPer {
						break
					}
				}
				return out, nil
			},
		},
		{
			kind: "StatefulSet",
			fetch: func() ([]SearchResult, error) {
				list, err := client.Clientset.AppsV1().StatefulSets(ns).List(ctx, metav1.ListOptions{Limit: 500})
				if err != nil {
					return nil, err
				}
				var out []SearchResult
				for _, item := range list.Items {
					if !matchQ(item.Name, item.Namespace, query) {
						continue
					}
					out = append(out, SearchResult{
						Kind: "StatefulSet", APIVersion: "apps/v1",
						Name: item.Name, Namespace: item.Namespace,
						Age:     formatAgeTime(item.CreationTimestamp.Time),
						NavPath: "/statefulsets",
					})
					if len(out) >= limitPer {
						break
					}
				}
				return out, nil
			},
		},
		{
			kind: "Ingress",
			fetch: func() ([]SearchResult, error) {
				list, err := client.Clientset.NetworkingV1().Ingresses(ns).List(ctx, metav1.ListOptions{Limit: 500})
				if err != nil {
					return nil, err
				}
				var out []SearchResult
				for _, item := range list.Items {
					if !matchQ(item.Name, item.Namespace, query) {
						continue
					}
					out = append(out, SearchResult{
						Kind: "Ingress", APIVersion: "networking.k8s.io/v1",
						Name: item.Name, Namespace: item.Namespace,
						Age:     formatAgeTime(item.CreationTimestamp.Time),
						NavPath: "/ingresses",
					})
					if len(out) >= limitPer {
						break
					}
				}
				return out, nil
			},
		},
		{
			kind: "Namespace",
			fetch: func() ([]SearchResult, error) {
				list, err := client.Clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{Limit: 200})
				if err != nil {
					return nil, err
				}
				var out []SearchResult
				for _, item := range list.Items {
					if !matchQ(item.Name, "", query) {
						continue
					}
					out = append(out, SearchResult{
						Kind: "Namespace", APIVersion: "v1",
						Name:    item.Name,
						Age:     formatAgeTime(item.CreationTimestamp.Time),
						NavPath: "/namespaces",
					})
					if len(out) >= limitPer {
						break
					}
				}
				return out, nil
			},
		},
		{
			kind: "Node",
			fetch: func() ([]SearchResult, error) {
				list, err := client.Clientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{Limit: 100})
				if err != nil {
					return nil, err
				}
				var out []SearchResult
				for _, item := range list.Items {
					if !matchQ(item.Name, "", query) {
						continue
					}
					out = append(out, SearchResult{
						Kind: "Node", APIVersion: "v1",
						Name:    item.Name,
						Age:     formatAgeTime(item.CreationTimestamp.Time),
						NavPath: "/nodes/" + item.Name,
					})
					if len(out) >= limitPer {
						break
					}
				}
				return out, nil
			},
		},
		{
			kind: "PersistentVolumeClaim",
			fetch: func() ([]SearchResult, error) {
				list, err := client.Clientset.CoreV1().PersistentVolumeClaims(ns).List(ctx, metav1.ListOptions{Limit: 200})
				if err != nil {
					return nil, err
				}
				var out []SearchResult
				for _, item := range list.Items {
					if !matchQ(item.Name, item.Namespace, query) {
						continue
					}
					out = append(out, SearchResult{
						Kind: "PersistentVolumeClaim", APIVersion: "v1",
						Name: item.Name, Namespace: item.Namespace,
						Age:     formatAgeTime(item.CreationTimestamp.Time),
						NavPath: "/persistentvolumeclaims",
					})
					if len(out) >= limitPer {
						break
					}
				}
				return out, nil
			},
		},
	}

	var mu sync.Mutex
	var allResults []SearchResult
	var wg sync.WaitGroup

	for _, t := range targets {
		wg.Add(1)
		go func(fetch func() ([]SearchResult, error)) {
			defer wg.Done()
			results, err := fetch()
			if err != nil {
				return
			}
			if len(results) > 0 {
				mu.Lock()
				allResults = append(allResults, results...)
				mu.Unlock()
			}
		}(t.fetch)
	}
	wg.Wait()

	// Sort: exact name matches first, then namespace matches
	exact := make([]SearchResult, 0)
	rest := make([]SearchResult, 0)
	q := strings.ToLower(query)
	for _, r := range allResults {
		if strings.ToLower(r.Name) == q {
			exact = append(exact, r)
		} else {
			rest = append(rest, r)
		}
	}
	ordered := append(exact, rest...)

	// Cap total at 100
	if len(ordered) > 100 {
		ordered = ordered[:100]
	}

	OKList(c, ordered, len(ordered), 1, 100)
}

func matchQ(name, namespace, query string) bool {
	q := strings.ToLower(query)
	return strings.Contains(strings.ToLower(name), q) ||
		strings.Contains(strings.ToLower(namespace), q)
}
