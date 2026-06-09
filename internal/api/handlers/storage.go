package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// ─── PersistentVolumes ────────────────────────────────────────────────────────

func (h *Handler) ListPersistentVolumes(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	p := parseListParams(c)
	list, err := client.Clientset.CoreV1().PersistentVolumes().List(c.Request.Context(), listOptions(p))
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	filtered := filterItems(list.Items, p.Search, func(i int) string { return list.Items[i].Name })
	OKList(c, pagSlice(filtered, p), len(filtered), p.Page, p.PageSize)
}

func (h *Handler) GetPersistentVolume(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	obj, err := client.Clientset.CoreV1().PersistentVolumes().Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	OK(c, obj)
}

func (h *Handler) DeletePersistentVolume(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	if err := client.Clientset.CoreV1().PersistentVolumes().Delete(c.Request.Context(), c.Param("name"), metav1.DeleteOptions{}); err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, gin.H{"deleted": c.Param("name")})
}

func (h *Handler) GetPersistentVolumeYAML(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	obj, err := client.Clientset.CoreV1().PersistentVolumes().Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	obj.ManagedFields = nil
	serveYAML(c, obj)
}

// ─── PersistentVolumeClaims ───────────────────────────────────────────────────

func (h *Handler) ListPersistentVolumeClaims(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	p := parseListParams(c)
	list, err := client.Clientset.CoreV1().PersistentVolumeClaims(nsParam(c, p)).List(c.Request.Context(), listOptions(p))
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	filtered := filterItems(list.Items, p.Search, func(i int) string { return list.Items[i].Name })
	OKList(c, pagSlice(filtered, p), len(filtered), p.Page, p.PageSize)
}

func (h *Handler) GetPersistentVolumeClaim(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	obj, err := client.Clientset.CoreV1().PersistentVolumeClaims(c.Param("namespace")).Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	OK(c, obj)
}

func (h *Handler) DeletePersistentVolumeClaim(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	if err := client.Clientset.CoreV1().PersistentVolumeClaims(c.Param("namespace")).Delete(c.Request.Context(), c.Param("name"), metav1.DeleteOptions{}); err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, gin.H{"deleted": c.Param("name")})
}

// ─── StorageClasses ───────────────────────────────────────────────────────────

func (h *Handler) ListStorageClasses(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	p := parseListParams(c)
	list, err := client.Clientset.StorageV1().StorageClasses().List(c.Request.Context(), listOptions(p))
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	filtered := filterItems(list.Items, p.Search, func(i int) string { return list.Items[i].Name })
	OKList(c, pagSlice(filtered, p), len(filtered), p.Page, p.PageSize)
}

func (h *Handler) GetStorageClass(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	obj, err := client.Clientset.StorageV1().StorageClasses().Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	OK(c, obj)
}

// ─── VolumeAttachments ────────────────────────────────────────────────────────

func (h *Handler) ListVolumeAttachments(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	list, err := client.Clientset.StorageV1().VolumeAttachments().List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, list.Items)
}

// ─── CSIDrivers ───────────────────────────────────────────────────────────────

func (h *Handler) ListCSIDrivers(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	list, err := client.Clientset.StorageV1().CSIDrivers().List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, list.Items)
}

// ─── CSINodes ─────────────────────────────────────────────────────────────────

func (h *Handler) ListCSINodes(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	list, err := client.Clientset.StorageV1().CSINodes().List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, list.Items)
}
