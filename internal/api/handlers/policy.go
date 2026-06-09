package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// ─── HorizontalPodAutoscalers ─────────────────────────────────────────────────

func (h *Handler) ListHPAs(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	p := parseListParams(c)
	list, err := client.Clientset.AutoscalingV2().HorizontalPodAutoscalers(nsParam(c, p)).List(c.Request.Context(), listOptions(p))
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	filtered := filterItems(list.Items, p.Search, func(i int) string { return list.Items[i].Name })
	OKList(c, pagSlice(filtered, p), len(filtered), p.Page, p.PageSize)
}

func (h *Handler) GetHPA(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	obj, err := client.Clientset.AutoscalingV2().HorizontalPodAutoscalers(c.Param("namespace")).Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	OK(c, obj)
}

func (h *Handler) DeleteHPA(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	if err := client.Clientset.AutoscalingV2().HorizontalPodAutoscalers(c.Param("namespace")).Delete(c.Request.Context(), c.Param("name"), metav1.DeleteOptions{}); err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, gin.H{"deleted": c.Param("name")})
}

// ─── PodDisruptionBudgets ─────────────────────────────────────────────────────

func (h *Handler) ListPodDisruptionBudgets(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	p := parseListParams(c)
	list, err := client.Clientset.PolicyV1().PodDisruptionBudgets(nsParam(c, p)).List(c.Request.Context(), listOptions(p))
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	filtered := filterItems(list.Items, p.Search, func(i int) string { return list.Items[i].Name })
	OKList(c, pagSlice(filtered, p), len(filtered), p.Page, p.PageSize)
}

func (h *Handler) GetPodDisruptionBudget(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	obj, err := client.Clientset.PolicyV1().PodDisruptionBudgets(c.Param("namespace")).Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	OK(c, obj)
}

func (h *Handler) DeletePodDisruptionBudget(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	if err := client.Clientset.PolicyV1().PodDisruptionBudgets(c.Param("namespace")).Delete(c.Request.Context(), c.Param("name"), metav1.DeleteOptions{}); err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, gin.H{"deleted": c.Param("name")})
}

// ─── PriorityClasses ──────────────────────────────────────────────────────────

func (h *Handler) ListPriorityClasses(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	list, err := client.Clientset.SchedulingV1().PriorityClasses().List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, list.Items)
}

func (h *Handler) GetPriorityClass(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	obj, err := client.Clientset.SchedulingV1().PriorityClasses().Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	OK(c, obj)
}

// ─── RuntimeClasses ───────────────────────────────────────────────────────────

func (h *Handler) ListRuntimeClasses(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	list, err := client.Clientset.NodeV1().RuntimeClasses().List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, list.Items)
}

func (h *Handler) GetRuntimeClass(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	obj, err := client.Clientset.NodeV1().RuntimeClasses().Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	OK(c, obj)
}

// ─── MutatingWebhookConfigurations ────────────────────────────────────────────

func (h *Handler) ListMutatingWebhooks(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	list, err := client.Clientset.AdmissionregistrationV1().MutatingWebhookConfigurations().List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, list.Items)
}

func (h *Handler) GetMutatingWebhook(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	obj, err := client.Clientset.AdmissionregistrationV1().MutatingWebhookConfigurations().Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	OK(c, obj)
}

func (h *Handler) DeleteMutatingWebhook(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	if err := client.Clientset.AdmissionregistrationV1().MutatingWebhookConfigurations().Delete(c.Request.Context(), c.Param("name"), metav1.DeleteOptions{}); err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, gin.H{"deleted": c.Param("name")})
}

// ─── ValidatingWebhookConfigurations ─────────────────────────────────────────

func (h *Handler) ListValidatingWebhooks(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	list, err := client.Clientset.AdmissionregistrationV1().ValidatingWebhookConfigurations().List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, list.Items)
}

func (h *Handler) GetValidatingWebhook(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	obj, err := client.Clientset.AdmissionregistrationV1().ValidatingWebhookConfigurations().Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	OK(c, obj)
}

func (h *Handler) DeleteValidatingWebhook(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	if err := client.Clientset.AdmissionregistrationV1().ValidatingWebhookConfigurations().Delete(c.Request.Context(), c.Param("name"), metav1.DeleteOptions{}); err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, gin.H{"deleted": c.Param("name")})
}

// ─── CertificateSigningRequests ───────────────────────────────────────────────

func (h *Handler) ListCertificateSigningRequests(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	list, err := client.Clientset.CertificatesV1().CertificateSigningRequests().List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, list.Items)
}

func (h *Handler) GetCertificateSigningRequest(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	obj, err := client.Clientset.CertificatesV1().CertificateSigningRequests().Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	OK(c, obj)
}

// ─── Leases ───────────────────────────────────────────────────────────────────

func (h *Handler) ListLeases(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	p := parseListParams(c)
	list, err := client.Clientset.CoordinationV1().Leases(nsParam(c, p)).List(c.Request.Context(), listOptions(p))
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, list.Items)
}

// ─── FlowSchemas ──────────────────────────────────────────────────────────────

func (h *Handler) ListFlowSchemas(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	list, err := client.Clientset.FlowcontrolV1().FlowSchemas().List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, list.Items)
}

func (h *Handler) GetFlowSchema(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	obj, err := client.Clientset.FlowcontrolV1().FlowSchemas().Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	OK(c, obj)
}

// ─── PriorityLevelConfigurations ──────────────────────────────────────────────

func (h *Handler) ListPriorityLevelConfigurations(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	list, err := client.Clientset.FlowcontrolV1().PriorityLevelConfigurations().List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, list.Items)
}

// ─── CustomResourceDefinitions ────────────────────────────────────────────────

func (h *Handler) ListCRDs(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	p := parseListParams(c)
	list, err := client.APIExtClient.ApiextensionsV1().CustomResourceDefinitions().List(c.Request.Context(), listOptions(p))
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	filtered := filterItems(list.Items, p.Search, func(i int) string { return list.Items[i].Name })
	OKList(c, pagSlice(filtered, p), len(filtered), p.Page, p.PageSize)
}

func (h *Handler) GetCRD(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	obj, err := client.APIExtClient.ApiextensionsV1().CustomResourceDefinitions().Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	OK(c, obj)
}

func (h *Handler) DeleteCRD(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	if err := client.APIExtClient.ApiextensionsV1().CustomResourceDefinitions().Delete(c.Request.Context(), c.Param("name"), metav1.DeleteOptions{}); err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, gin.H{"deleted": c.Param("name")})
}
