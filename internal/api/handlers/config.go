package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// ─── ConfigMaps ───────────────────────────────────────────────────────────────

func (h *Handler) ListConfigMaps(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	p := parseListParams(c)
	list, err := client.Clientset.CoreV1().ConfigMaps(nsParam(c, p)).List(c.Request.Context(), listOptions(p))
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	filtered := filterItems(list.Items, p.Search, func(i int) string { return list.Items[i].Name })
	OKList(c, pagSlice(filtered, p), len(filtered), p.Page, p.PageSize)
}

func (h *Handler) GetConfigMap(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	obj, err := client.Clientset.CoreV1().ConfigMaps(c.Param("namespace")).Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	OK(c, obj)
}

func (h *Handler) DeleteConfigMap(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	if err := client.Clientset.CoreV1().ConfigMaps(c.Param("namespace")).Delete(c.Request.Context(), c.Param("name"), metav1.DeleteOptions{}); err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, gin.H{"deleted": c.Param("name")})
}

func (h *Handler) GetConfigMapYAML(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	obj, err := client.Clientset.CoreV1().ConfigMaps(c.Param("namespace")).Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	obj.ManagedFields = nil
	serveYAML(c, obj)
}

// ─── Secrets ──────────────────────────────────────────────────────────────────

func (h *Handler) ListSecrets(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	p := parseListParams(c)
	list, err := client.Clientset.CoreV1().Secrets(nsParam(c, p)).List(c.Request.Context(), listOptions(p))
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	type SecretSummary struct {
		Name      string            `json:"name"`
		Namespace string            `json:"namespace"`
		Type      corev1.SecretType `json:"type"`
		Keys      []string          `json:"keys"`
		Age       metav1.Time       `json:"creationTimestamp"`
		Labels    map[string]string `json:"labels,omitempty"`
	}

	filtered := filterItems(list.Items, p.Search, func(i int) string { return list.Items[i].Name })
	summaries := make([]SecretSummary, 0, len(filtered))
	for _, s := range filtered {
		keys := make([]string, 0, len(s.Data))
		for k := range s.Data {
			keys = append(keys, k)
		}
		summaries = append(summaries, SecretSummary{
			Name:      s.Name,
			Namespace: s.Namespace,
			Type:      s.Type,
			Keys:      keys,
			Age:       s.CreationTimestamp,
			Labels:    s.Labels,
		})
	}
	OKList(c, pagSlice(summaries, p), len(summaries), p.Page, p.PageSize)
}

func (h *Handler) GetSecret(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	reveal := c.Query("reveal")
	obj, err := client.Clientset.CoreV1().Secrets(c.Param("namespace")).Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	if reveal != "true" {
		maskedData := make(map[string]string, len(obj.Data))
		for k := range obj.Data {
			maskedData[k] = "***"
		}
		OK(c, gin.H{
			"metadata":   obj.ObjectMeta,
			"type":       obj.Type,
			"maskedData": maskedData,
		})
		return
	}
	OK(c, obj)
}

func (h *Handler) DeleteSecret(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	if err := client.Clientset.CoreV1().Secrets(c.Param("namespace")).Delete(c.Request.Context(), c.Param("name"), metav1.DeleteOptions{}); err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, gin.H{"deleted": c.Param("name")})
}

func (h *Handler) GetSecretYAML(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	obj, err := client.Clientset.CoreV1().Secrets(c.Param("namespace")).Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	obj.ManagedFields = nil
	for k := range obj.Data {
		obj.Data[k] = []byte("***")
	}
	serveYAML(c, obj)
}

// ─── ServiceAccounts ──────────────────────────────────────────────────────────

func (h *Handler) ListServiceAccounts(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	p := parseListParams(c)
	list, err := client.Clientset.CoreV1().ServiceAccounts(nsParam(c, p)).List(c.Request.Context(), listOptions(p))
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	filtered := filterItems(list.Items, p.Search, func(i int) string { return list.Items[i].Name })
	OKList(c, pagSlice(filtered, p), len(filtered), p.Page, p.PageSize)
}

func (h *Handler) GetServiceAccount(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	obj, err := client.Clientset.CoreV1().ServiceAccounts(c.Param("namespace")).Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	OK(c, obj)
}

func (h *Handler) DeleteServiceAccount(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	if err := client.Clientset.CoreV1().ServiceAccounts(c.Param("namespace")).Delete(c.Request.Context(), c.Param("name"), metav1.DeleteOptions{}); err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, gin.H{"deleted": c.Param("name")})
}

// ─── ResourceQuotas ───────────────────────────────────────────────────────────

func (h *Handler) ListResourceQuotas(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	p := parseListParams(c)
	list, err := client.Clientset.CoreV1().ResourceQuotas(nsParam(c, p)).List(c.Request.Context(), listOptions(p))
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, list.Items)
}

func (h *Handler) GetResourceQuota(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	obj, err := client.Clientset.CoreV1().ResourceQuotas(c.Param("namespace")).Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	OK(c, obj)
}

// ─── LimitRanges ──────────────────────────────────────────────────────────────

func (h *Handler) ListLimitRanges(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	p := parseListParams(c)
	list, err := client.Clientset.CoreV1().LimitRanges(nsParam(c, p)).List(c.Request.Context(), listOptions(p))
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, list.Items)
}

func (h *Handler) GetLimitRange(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	obj, err := client.Clientset.CoreV1().LimitRanges(c.Param("namespace")).Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	OK(c, obj)
}

// ─── PodTemplates ─────────────────────────────────────────────────────────────

func (h *Handler) ListPodTemplates(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	p := parseListParams(c)
	list, err := client.Clientset.CoreV1().PodTemplates(nsParam(c, p)).List(c.Request.Context(), listOptions(p))
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, list.Items)
}
