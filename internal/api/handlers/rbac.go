package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// ─── Roles ────────────────────────────────────────────────────────────────────

func (h *Handler) ListRoles(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	p := parseListParams(c)
	list, err := client.Clientset.RbacV1().Roles(nsParam(c, p)).List(c.Request.Context(), listOptions(p))
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	filtered := filterItems(list.Items, p.Search, func(i int) string { return list.Items[i].Name })
	OKList(c, pagSlice(filtered, p), len(filtered), p.Page, p.PageSize)
}

func (h *Handler) GetRole(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	obj, err := client.Clientset.RbacV1().Roles(c.Param("namespace")).Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	OK(c, obj)
}

func (h *Handler) DeleteRole(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	if err := client.Clientset.RbacV1().Roles(c.Param("namespace")).Delete(c.Request.Context(), c.Param("name"), metav1.DeleteOptions{}); err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, gin.H{"deleted": c.Param("name")})
}

// ─── ClusterRoles ─────────────────────────────────────────────────────────────

func (h *Handler) ListClusterRoles(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	p := parseListParams(c)
	list, err := client.Clientset.RbacV1().ClusterRoles().List(c.Request.Context(), listOptions(p))
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	filtered := filterItems(list.Items, p.Search, func(i int) string { return list.Items[i].Name })
	OKList(c, pagSlice(filtered, p), len(filtered), p.Page, p.PageSize)
}

func (h *Handler) GetClusterRole(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	obj, err := client.Clientset.RbacV1().ClusterRoles().Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	OK(c, obj)
}

func (h *Handler) DeleteClusterRole(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	if err := client.Clientset.RbacV1().ClusterRoles().Delete(c.Request.Context(), c.Param("name"), metav1.DeleteOptions{}); err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, gin.H{"deleted": c.Param("name")})
}

// ─── RoleBindings ─────────────────────────────────────────────────────────────

func (h *Handler) ListRoleBindings(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	p := parseListParams(c)
	list, err := client.Clientset.RbacV1().RoleBindings(nsParam(c, p)).List(c.Request.Context(), listOptions(p))
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	filtered := filterItems(list.Items, p.Search, func(i int) string { return list.Items[i].Name })
	OKList(c, pagSlice(filtered, p), len(filtered), p.Page, p.PageSize)
}

func (h *Handler) GetRoleBinding(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	obj, err := client.Clientset.RbacV1().RoleBindings(c.Param("namespace")).Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	OK(c, obj)
}

func (h *Handler) DeleteRoleBinding(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	if err := client.Clientset.RbacV1().RoleBindings(c.Param("namespace")).Delete(c.Request.Context(), c.Param("name"), metav1.DeleteOptions{}); err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, gin.H{"deleted": c.Param("name")})
}

// ─── ClusterRoleBindings ──────────────────────────────────────────────────────

func (h *Handler) ListClusterRoleBindings(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	p := parseListParams(c)
	list, err := client.Clientset.RbacV1().ClusterRoleBindings().List(c.Request.Context(), listOptions(p))
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	filtered := filterItems(list.Items, p.Search, func(i int) string { return list.Items[i].Name })
	OKList(c, pagSlice(filtered, p), len(filtered), p.Page, p.PageSize)
}

func (h *Handler) GetClusterRoleBinding(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	obj, err := client.Clientset.RbacV1().ClusterRoleBindings().Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	OK(c, obj)
}

func (h *Handler) DeleteClusterRoleBinding(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	if err := client.Clientset.RbacV1().ClusterRoleBindings().Delete(c.Request.Context(), c.Param("name"), metav1.DeleteOptions{}); err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, gin.H{"deleted": c.Param("name")})
}
