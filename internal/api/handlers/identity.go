package handlers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// IdentitySubject is a user, group, or service account that has cluster access
type IdentitySubject struct {
	Kind        string       `json:"kind"`   // User | Group | ServiceAccount
	Name        string       `json:"name"`
	Namespace   string       `json:"namespace,omitempty"`
	Roles       []BoundRole  `json:"roles"`
	IsSystem    bool         `json:"isSystem"`
}

type BoundRole struct {
	RoleKind  string `json:"roleKind"`  // Role | ClusterRole
	RoleName  string `json:"roleName"`
	BindingNS string `json:"bindingNamespace,omitempty"`
}

// ListIdentities aggregates all subjects across ClusterRoleBindings and RoleBindings
func (h *Handler) ListIdentities(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	ctx := c.Request.Context()

	// key: "Kind/name[/namespace]"
	subjectMap := map[string]*IdentitySubject{}

	ensureSubject := func(s rbacv1.Subject) string {
		key := s.Kind + "/" + s.Name
		if s.Namespace != "" {
			key += "/" + s.Namespace
		}
		if _, exists := subjectMap[key]; !exists {
			subjectMap[key] = &IdentitySubject{
				Kind:      s.Kind,
				Name:      s.Name,
				Namespace: s.Namespace,
				IsSystem:  isSystemSubject(s.Name),
			}
		}
		return key
	}

	// ClusterRoleBindings → cluster-wide subjects
	crbs, err := client.Clientset.RbacV1().ClusterRoleBindings().List(ctx, metav1.ListOptions{})
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	for _, crb := range crbs.Items {
		for _, s := range crb.Subjects {
			key := ensureSubject(s)
			subjectMap[key].Roles = append(subjectMap[key].Roles, BoundRole{
				RoleKind: crb.RoleRef.Kind,
				RoleName: crb.RoleRef.Name,
			})
		}
	}

	// RoleBindings (namespace-scoped) — search all namespaces
	rbs, err := client.Clientset.RbacV1().RoleBindings("").List(ctx, metav1.ListOptions{})
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	for _, rb := range rbs.Items {
		for _, s := range rb.Subjects {
			key := ensureSubject(s)
			subjectMap[key].Roles = append(subjectMap[key].Roles, BoundRole{
				RoleKind:  rb.RoleRef.Kind,
				RoleName:  rb.RoleRef.Name,
				BindingNS: rb.Namespace,
			})
		}
	}

	// Also include ServiceAccounts that have NO bindings (orphaned)
	sas, err := client.Clientset.CoreV1().ServiceAccounts("").List(ctx, metav1.ListOptions{})
	if err == nil {
		for _, sa := range sas.Items {
			key := fmt.Sprintf("ServiceAccount/%s/%s", sa.Name, sa.Namespace)
			if _, exists := subjectMap[key]; !exists {
				subjectMap[key] = &IdentitySubject{
					Kind:      "ServiceAccount",
					Name:      sa.Name,
					Namespace: sa.Namespace,
					IsSystem:  isSystemSubject(sa.Name),
					Roles:     []BoundRole{},
				}
			}
		}
	}

	// Convert to slice
	p := parseListParams(c)
	showSystem := c.DefaultQuery("showSystem", "false") == "true"
	result := make([]IdentitySubject, 0, len(subjectMap))
	for _, sub := range subjectMap {
		if !showSystem && sub.IsSystem {
			continue
		}
		if p.Search != "" && !matchQ(sub.Name, sub.Namespace, p.Search) {
			continue
		}
		result = append(result, *sub)
	}
	OKList(c, pagSlice(result, p), len(result), p.Page, p.PageSize)
}

// GetIdentityPermissions returns what a specific subject can do
func (h *Handler) GetIdentityPermissions(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	ctx := c.Request.Context()
	kind := c.Param("kind")
	name := c.Param("name")

	type PermissionRule struct {
		APIGroups []string `json:"apiGroups"`
		Resources []string `json:"resources"`
		Verbs     []string `json:"verbs"`
		Source    string   `json:"source"`
	}

	var rules []PermissionRule

	// Find all ClusterRoles bound to this subject
	crbs, _ := client.Clientset.RbacV1().ClusterRoleBindings().List(ctx, metav1.ListOptions{})
	for _, crb := range crbs.Items {
		for _, s := range crb.Subjects {
			if s.Kind == kind && s.Name == name {
				cr, err := client.Clientset.RbacV1().ClusterRoles().Get(ctx, crb.RoleRef.Name, metav1.GetOptions{})
				if err != nil {
					continue
				}
				for _, rule := range cr.Rules {
					rules = append(rules, PermissionRule{
						APIGroups: rule.APIGroups,
						Resources: rule.Resources,
						Verbs:     rule.Verbs,
						Source:    "ClusterRole/" + cr.Name,
					})
				}
			}
		}
	}

	OK(c, gin.H{"subject": gin.H{"kind": kind, "name": name}, "rules": rules})
}

// GetQuotaSummary returns resource quota usage for a namespace
func (h *Handler) GetQuotaSummary(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	ns := c.Param("namespace")
	ctx := c.Request.Context()

	quotas, err := client.Clientset.CoreV1().ResourceQuotas(ns).List(ctx, metav1.ListOptions{})
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	type QuotaEntry struct {
		Resource string `json:"resource"`
		Hard     string `json:"hard"`
		Used     string `json:"used"`
		UsedPct  float64 `json:"usedPercent"`
	}
	type QuotaSummary struct {
		Name    string       `json:"name"`
		Entries []QuotaEntry `json:"entries"`
	}

	summaries := make([]QuotaSummary, 0, len(quotas.Items))
	for _, q := range quotas.Items {
		entries := make([]QuotaEntry, 0)
		for res, hard := range q.Status.Hard {
			used := q.Status.Used[res]
			hardVal := hard.MilliValue()
			usedVal := used.MilliValue()
			pct := 0.0
			if hardVal > 0 {
				pct = float64(usedVal) / float64(hardVal) * 100
			}
			entries = append(entries, QuotaEntry{
				Resource: string(res),
				Hard:     hard.String(),
				Used:     used.String(),
				UsedPct:  pct,
			})
		}
		summaries = append(summaries, QuotaSummary{Name: q.Name, Entries: entries})
	}
	OK(c, summaries)
}

func isSystemSubject(name string) bool {
	systemPrefixes := []string{
		"system:", "kube-", "local-path", "kindnet", "coredns",
		"metrics-server", "default",
	}
	for _, prefix := range systemPrefixes {
		if len(name) >= len(prefix) && name[:len(prefix)] == prefix {
			return true
		}
	}
	return false
}
