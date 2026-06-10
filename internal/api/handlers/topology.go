package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
)

// TopologyNode is a resource node in the network graph
type TopologyNode struct {
	ID        string            `json:"id"`
	Kind      string            `json:"kind"`
	Name      string            `json:"name"`
	Namespace string            `json:"namespace"`
	Labels    map[string]string `json:"labels,omitempty"`
	Status    string            `json:"status"`
	Data      interface{}       `json:"data,omitempty"`
}

// TopologyEdge is a directed connection between two nodes
type TopologyEdge struct {
	ID     string `json:"id"`
	Source string `json:"source"`
	Target string `json:"target"`
	Label  string `json:"label,omitempty"`
}

// TopologyResponse is the complete graph for a namespace
type TopologyResponse struct {
	Nodes []TopologyNode `json:"nodes"`
	Edges []TopologyEdge `json:"edges"`
}

// GetNetworkTopology builds a node/edge graph for a namespace:
// Ingress → Service → Pod(s) + NetworkPolicy overlays
func (h *Handler) GetNetworkTopology(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	ns := c.Param("namespace")
	if ns == "" {
		ns = c.DefaultQuery("namespace", "default")
	}
	ctx := c.Request.Context()

	nodes := make([]TopologyNode, 0)
	edges := make([]TopologyEdge, 0)
	edgeSet := map[string]bool{}

	addEdge := func(src, tgt, label string) {
		id := src + "->" + tgt
		if edgeSet[id] {
			return
		}
		edgeSet[id] = true
		edges = append(edges, TopologyEdge{
			ID: id, Source: src, Target: tgt, Label: label,
		})
	}

	// ── Pods ─────────────────────────────────────────────────────────────────
	pods, err := client.Clientset.CoreV1().Pods(ns).List(ctx, metav1.ListOptions{})
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	podByLabel := map[string]string{} // label selector key → pod node id
	for _, pod := range pods.Items {
		id := "pod-" + pod.Name
		status := string(pod.Status.Phase)
		nodes = append(nodes, TopologyNode{
			ID: id, Kind: "Pod",
			Name: pod.Name, Namespace: pod.Namespace,
			Labels: pod.Labels, Status: status,
		})
		for k, v := range pod.Labels {
			podByLabel[k+"="+v] = id
		}
	}

	// ── Services ─────────────────────────────────────────────────────────────
	services, err := client.Clientset.CoreV1().Services(ns).List(ctx, metav1.ListOptions{})
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	for _, svc := range services.Items {
		id := "svc-" + svc.Name
		nodes = append(nodes, TopologyNode{
			ID: id, Kind: "Service",
			Name: svc.Name, Namespace: svc.Namespace,
			Labels: svc.Labels,
			Status: string(svc.Spec.Type),
			Data:   svc.Spec.ClusterIP,
		})
		// Connect service → matching pods via selector
		if svc.Spec.Selector != nil {
			sel := labels.Set(svc.Spec.Selector).String()
			for _, pod := range pods.Items {
				podLabels := labels.Set(pod.Labels)
				svcSelector := labels.Set(svc.Spec.Selector)
				match := true
				for k, v := range svcSelector {
					if podLabels[k] != v {
						match = false
						break
					}
				}
				if match {
					addEdge(id, "pod-"+pod.Name, sel)
				}
			}
		}
	}

	// ── Ingresses ─────────────────────────────────────────────────────────────
	ingresses, err := client.Clientset.NetworkingV1().Ingresses(ns).List(ctx, metav1.ListOptions{})
	if err == nil {
		for _, ing := range ingresses.Items {
			id := "ing-" + ing.Name
			nodes = append(nodes, TopologyNode{
				ID: id, Kind: "Ingress",
				Name: ing.Name, Namespace: ing.Namespace,
				Labels: ing.Labels, Status: "active",
			})
			// Connect ingress → referenced services
			for _, rule := range ing.Spec.Rules {
				if rule.HTTP == nil {
					continue
				}
				for _, path := range rule.HTTP.Paths {
					if path.Backend.Service != nil {
						svcID := "svc-" + path.Backend.Service.Name
						addEdge(id, svcID, rule.Host+path.Path)
					}
				}
			}
		}
	}

	// ── Deployments ───────────────────────────────────────────────────────────
	deployments, err := client.Clientset.AppsV1().Deployments(ns).List(ctx, metav1.ListOptions{})
	if err == nil {
		for _, dep := range deployments.Items {
			id := "dep-" + dep.Name
			nodes = append(nodes, TopologyNode{
				ID: id, Kind: "Deployment",
				Name: dep.Name, Namespace: dep.Namespace,
				Labels: dep.Labels,
				Status: func() string {
					if dep.Status.AvailableReplicas == *dep.Spec.Replicas {
						return "available"
					}
					return "degraded"
				}(),
			})
			// Connect deployment → its pods via matchLabels
			if dep.Spec.Selector != nil {
				for _, pod := range pods.Items {
					podLabels := labels.Set(pod.Labels)
					sel := dep.Spec.Selector.MatchLabels
					match := true
					for k, v := range sel {
						if podLabels[k] != v {
							match = false
							break
						}
					}
					if match {
						addEdge(id, "pod-"+pod.Name, "manages")
					}
				}
			}
		}
	}

	// ── NetworkPolicies ───────────────────────────────────────────────────────
	netpols, err := client.Clientset.NetworkingV1().NetworkPolicies(ns).List(ctx, metav1.ListOptions{})
	if err == nil {
		for _, np := range netpols.Items {
			id := "np-" + np.Name
			nodes = append(nodes, TopologyNode{
				ID: id, Kind: "NetworkPolicy",
				Name: np.Name, Namespace: np.Namespace,
				Labels: np.Labels, Status: "active",
			})
		}
	}

	OK(c, TopologyResponse{Nodes: nodes, Edges: edges})
}
