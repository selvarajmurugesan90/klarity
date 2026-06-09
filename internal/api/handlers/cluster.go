package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// ─── Namespaces ───────────────────────────────────────────────────────────────

func (h *Handler) ListNamespaces(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	p := parseListParams(c)
	list, err := client.Clientset.CoreV1().Namespaces().List(c.Request.Context(), listOptions(p))
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	filtered := filterItems(list.Items, p.Search, func(i int) string { return list.Items[i].Name })
	OKList(c, pagSlice(filtered, p), len(filtered), p.Page, p.PageSize)
}

func (h *Handler) GetNamespace(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	name := c.Param("namespace")
	if name == "" {
		name = c.Param("name")
	}
	obj, err := client.Clientset.CoreV1().Namespaces().Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	OK(c, obj)
}

func (h *Handler) DeleteNamespace(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	name := c.Param("namespace")
	if name == "" {
		name = c.Param("name")
	}
	if err := client.Clientset.CoreV1().Namespaces().Delete(c.Request.Context(), name, metav1.DeleteOptions{}); err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, gin.H{"deleted": name})
}

// ─── Nodes ────────────────────────────────────────────────────────────────────

func (h *Handler) ListNodes(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	p := parseListParams(c)
	list, err := client.Clientset.CoreV1().Nodes().List(c.Request.Context(), listOptions(p))
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	filtered := filterItems(list.Items, p.Search, func(i int) string { return list.Items[i].Name })
	OKList(c, pagSlice(filtered, p), len(filtered), p.Page, p.PageSize)
}

func (h *Handler) GetNode(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	obj, err := client.Clientset.CoreV1().Nodes().Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	OK(c, obj)
}

func (h *Handler) GetNodeYAML(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	obj, err := client.Clientset.CoreV1().Nodes().Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	obj.ManagedFields = nil
	serveYAML(c, obj)
}

func (h *Handler) GetNodePods(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	name := c.Param("name")
	list, err := client.Clientset.CoreV1().Pods("").List(c.Request.Context(), metav1.ListOptions{
		FieldSelector: "spec.nodeName=" + name,
	})
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, list.Items)
}

func (h *Handler) CordonNode(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	var body struct{ Cordon bool `json:"cordon"` }
	if err := c.ShouldBindJSON(&body); err != nil {
		Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	cordonStr := "true"
	if !body.Cordon {
		cordonStr = "false"
	}
	patch := `{"spec":{"unschedulable":` + cordonStr + `}}`
	result, err := client.Clientset.CoreV1().Nodes().Patch(
		c.Request.Context(), c.Param("name"),
		"application/merge-patch+json", []byte(patch), metav1.PatchOptions{})
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, result)
}

// ─── Events ───────────────────────────────────────────────────────────────────

func (h *Handler) ListEvents(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	p := parseListParams(c)
	ns := c.Param("namespace")
	if ns == "" {
		ns = c.DefaultQuery("namespace", "")
	}

	opts := listOptions(p)
	if t := c.Query("type"); t != "" {
		if opts.FieldSelector != "" {
			opts.FieldSelector += ","
		}
		opts.FieldSelector += "type=" + t
	}

	list, err := client.Clientset.CoreV1().Events(ns).List(c.Request.Context(), opts)
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	filtered := filterItems(list.Items, p.Search, func(i int) string {
		return list.Items[i].InvolvedObject.Name + " " + list.Items[i].Reason
	})
	OKList(c, pagSlice(filtered, p), len(filtered), p.Page, p.PageSize)
}

// ─── ComponentStatuses ────────────────────────────────────────────────────────

func (h *Handler) ListComponentStatuses(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	list, err := client.Clientset.CoreV1().ComponentStatuses().List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, list.Items)
}

// ─── Clusters ─────────────────────────────────────────────────────────────────

func (h *Handler) ListClusters(c *gin.Context) {
	names := h.Manager.List()
	type ClusterInfo struct {
		Name    string `json:"name"`
		Current bool   `json:"current"`
	}
	current := h.Manager.CurrentName()
	infos := make([]ClusterInfo, 0, len(names))
	for _, n := range names {
		infos = append(infos, ClusterInfo{Name: n, Current: n == current})
	}
	OK(c, infos)
}

func (h *Handler) SwitchCluster(c *gin.Context) {
	var body struct{ Name string `json:"name"` }
	if err := c.ShouldBindJSON(&body); err != nil {
		Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.Manager.Switch(body.Name); err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	OK(c, gin.H{"switched": body.Name})
}

func (h *Handler) GetServerVersion(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	v, err := client.GetServerVersion()
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, gin.H{"version": v})
}
