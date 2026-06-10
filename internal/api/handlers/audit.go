package handlers

import (
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// AuditEvent records a single user action
type AuditEvent struct {
	ID        int64     `json:"id"`
	Timestamp time.Time `json:"timestamp"`
	User      string    `json:"user"`
	Method    string    `json:"method"`
	Action    string    `json:"action"`    // create | update | delete | scale | restart | exec
	Resource  string    `json:"resource"`  // e.g. "Pod"
	Namespace string    `json:"namespace"`
	Name      string    `json:"name"`
	Path      string    `json:"path"`
	Status    int       `json:"status"`
	Message   string    `json:"message,omitempty"`
	Cluster   string    `json:"cluster"`
}

const auditRingSize = 2000

// AuditStore is an in-memory ring buffer for audit events
type AuditStore struct {
	mu     sync.RWMutex
	events []AuditEvent
	head   int
	count  int
	nextID int64
}

var globalAudit = &AuditStore{
	events: make([]AuditEvent, auditRingSize),
}

func (a *AuditStore) Record(ev AuditEvent) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.nextID++
	ev.ID = a.nextID
	a.events[a.head] = ev
	a.head = (a.head + 1) % auditRingSize
	if a.count < auditRingSize {
		a.count++
	}
}

func (a *AuditStore) List(limit int, search, action, resource string) []AuditEvent {
	a.mu.RLock()
	defer a.mu.RUnlock()

	result := make([]AuditEvent, 0, a.count)
	// Read newest first (reverse ring order)
	for i := 0; i < a.count; i++ {
		idx := ((a.head - 1 - i) + auditRingSize) % auditRingSize
		ev := a.events[idx]
		if ev.ID == 0 {
			continue
		}
		if search != "" && !strings.Contains(strings.ToLower(ev.Name), strings.ToLower(search)) &&
			!strings.Contains(strings.ToLower(ev.Namespace), strings.ToLower(search)) {
			continue
		}
		if action != "" && ev.Action != action {
			continue
		}
		if resource != "" && !strings.EqualFold(ev.Resource, resource) {
			continue
		}
		result = append(result, ev)
		if limit > 0 && len(result) >= limit {
			break
		}
	}
	return result
}

// AuditMiddleware records mutating API calls (POST/PUT/PATCH/DELETE) into the audit store
func AuditMiddleware(clusterFn func() string) gin.HandlerFunc {
	return func(c *gin.Context) {
		method := c.Request.Method
		// Only audit mutating operations
		if method == http.MethodGet || method == http.MethodOptions || method == http.MethodHead {
			c.Next()
			return
		}

		c.Next()

		path := c.Request.URL.Path
		parts := strings.Split(strings.Trim(path, "/"), "/")

		ev := AuditEvent{
			Timestamp: time.Now().UTC(),
			Method:    method,
			Path:      path,
			Status:    c.Writer.Status(),
			User:      c.GetString("k8s_user"),
			Cluster:   clusterFn(),
		}
		if ev.User == "" {
			ev.User = "anonymous"
		}

		// Parse namespace + name + resource from path
		// /api/v1/namespaces/:namespace/pods/:name
		for i, p := range parts {
			if p == "namespaces" && i+1 < len(parts) {
				ev.Namespace = parts[i+1]
			}
		}
		if len(parts) > 0 {
			ev.Name = parts[len(parts)-1]
		}

		// Determine action
		switch method {
		case http.MethodPost:
			ev.Action = "create"
			if strings.HasSuffix(path, "/scale") {
				ev.Action = "scale"
			} else if strings.HasSuffix(path, "/restart") {
				ev.Action = "restart"
			} else if strings.HasSuffix(path, "/trigger") {
				ev.Action = "trigger"
			}
		case http.MethodPut:
			ev.Action = "update"
			if strings.HasSuffix(path, "/scale") {
				ev.Action = "scale"
			}
		case http.MethodPatch:
			ev.Action = "patch"
			if strings.HasSuffix(path, "/cordon") {
				ev.Action = "cordon"
			}
		case http.MethodDelete:
			ev.Action = "delete"
		}

		// Determine resource kind from path
		knownResources := map[string]string{
			"pods": "Pod", "deployments": "Deployment", "statefulsets": "StatefulSet",
			"daemonsets": "DaemonSet", "replicasets": "ReplicaSet", "jobs": "Job",
			"cronjobs": "CronJob", "services": "Service", "ingresses": "Ingress",
			"configmaps": "ConfigMap", "secrets": "Secret", "namespaces": "Namespace",
			"nodes": "Node", "persistentvolumes": "PersistentVolume",
			"persistentvolumeclaims": "PersistentVolumeClaim", "roles": "Role",
			"clusterroles": "ClusterRole", "rolebindings": "RoleBinding",
			"clusterrolebindings": "ClusterRoleBinding", "serviceaccounts": "ServiceAccount",
		}
		for _, p := range parts {
			if kind, ok := knownResources[p]; ok {
				ev.Resource = kind
			}
		}

		globalAudit.Record(ev)
	}
}

// GetAuditLog returns the audit event list
func (h *Handler) GetAuditLog(c *gin.Context) {
	p := parseListParams(c)
	action := c.Query("action")
	resource := c.Query("resource")

	limit := p.PageSize
	if limit <= 0 {
		limit = 100
	}

	events := globalAudit.List(limit, p.Search, action, resource)
	OKList(c, events, len(events), p.Page, p.PageSize)
}

// GetAuditStats returns summary stats
func (h *Handler) GetAuditStats(c *gin.Context) {
	events := globalAudit.List(0, "", "", "")
	stats := map[string]int{}
	for _, ev := range events {
		stats[ev.Action]++
		stats["total"]++
	}
	OK(c, stats)
}
