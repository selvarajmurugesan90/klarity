package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// GitOps tool identifiers
const (
	GitOpsToolArgoCD = "argocd"
	GitOpsToolFlux   = "flux"
)

// GitOpsStatus reports which GitOps tools are detected in the cluster
type GitOpsStatus struct {
	ArgoCD ArgoStatus `json:"argocd"`
	Flux   FluxStatus `json:"flux"`
}

type ArgoStatus struct {
	Detected bool   `json:"detected"`
	Version  string `json:"version,omitempty"`
}

type FluxStatus struct {
	Detected bool   `json:"detected"`
	Version  string `json:"version,omitempty"`
}

// GetGitOpsStatus auto-detects ArgoCD and Flux by checking their CRDs
func (h *Handler) GetGitOpsStatus(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	ctx := c.Request.Context()
	status := GitOpsStatus{}

	// Detect ArgoCD — check for Application CRD
	_, err := client.DynamicClient.Resource(schema.GroupVersionResource{
		Group: "argoproj.io", Version: "v1alpha1", Resource: "applications",
	}).List(ctx, metav1.ListOptions{Limit: 1})
	if err == nil {
		status.ArgoCD.Detected = true
		// Try to get ArgoCD version from the argocd-cm ConfigMap
		if cm, e := client.Clientset.CoreV1().ConfigMaps("argocd").Get(ctx, "argocd-cm", metav1.GetOptions{}); e == nil {
			if v, ok := cm.Data["application.resourceVersionConstraint"]; ok {
				status.ArgoCD.Version = v
			}
		}
	}

	// Detect Flux — check for Kustomization CRD
	_, err = client.DynamicClient.Resource(schema.GroupVersionResource{
		Group: "kustomize.toolkit.fluxcd.io", Version: "v1", Resource: "kustomizations",
	}).List(ctx, metav1.ListOptions{Limit: 1})
	if err == nil {
		status.Flux.Detected = true
		// Try to get Flux version from flux-system namespace
		if cm, e := client.Clientset.CoreV1().ConfigMaps("flux-system").Get(ctx, "flux-system", metav1.GetOptions{}); e == nil {
			if v, ok := cm.Data["flux-version"]; ok {
				status.Flux.Version = v
			}
		}
	}

	OK(c, status)
}

// ─── ArgoCD ───────────────────────────────────────────────────────────────────

var argoAppGVR = schema.GroupVersionResource{
	Group: "argoproj.io", Version: "v1alpha1", Resource: "applications",
}
var argoAppSetGVR = schema.GroupVersionResource{
	Group: "argoproj.io", Version: "v1alpha1", Resource: "applicationsets",
}
var argoProjectGVR = schema.GroupVersionResource{
	Group: "argoproj.io", Version: "v1alpha1", Resource: "appprojects",
}

func (h *Handler) ListArgoApps(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	p := parseListParams(c)
	ns := c.DefaultQuery("namespace", "")

	list, err := client.DynamicClient.Resource(argoAppGVR).Namespace(ns).List(
		c.Request.Context(), listOptions(p))
	if err != nil {
		Fail(c, http.StatusInternalServerError, "ArgoCD not available: "+err.Error())
		return
	}
	filtered := filterUnstructured(list.Items, p.Search)
	total := len(filtered)
	offset, limit := paginate(total, p.Page, p.PageSize)
	end := offset + limit
	if end > total {
		end = total
	}
	OKList(c, filtered[offset:end], total, p.Page, p.PageSize)
}

func (h *Handler) GetArgoApp(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	ns := c.Param("namespace")
	if ns == "" {
		ns = c.DefaultQuery("namespace", "argocd")
	}
	obj, err := client.DynamicClient.Resource(argoAppGVR).Namespace(ns).Get(
		c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	OK(c, obj)
}

func (h *Handler) ListArgoAppSets(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	p := parseListParams(c)
	list, err := client.DynamicClient.Resource(argoAppSetGVR).List(c.Request.Context(), listOptions(p))
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OKList(c, list.Items, len(list.Items), p.Page, p.PageSize)
}

func (h *Handler) ListArgoProjects(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	list, err := client.DynamicClient.Resource(argoProjectGVR).List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, list.Items)
}

// ─── Flux CD ──────────────────────────────────────────────────────────────────

var (
	fluxGitRepoGVR       = schema.GroupVersionResource{Group: "source.toolkit.fluxcd.io", Version: "v1", Resource: "gitrepositories"}
	fluxHelmRepoGVR      = schema.GroupVersionResource{Group: "source.toolkit.fluxcd.io", Version: "v1beta2", Resource: "helmrepositories"}
	fluxOCIRepoGVR       = schema.GroupVersionResource{Group: "source.toolkit.fluxcd.io", Version: "v1beta2", Resource: "ocirepositories"}
	fluxKustomizationGVR = schema.GroupVersionResource{Group: "kustomize.toolkit.fluxcd.io", Version: "v1", Resource: "kustomizations"}
	fluxHelmReleaseGVR   = schema.GroupVersionResource{Group: "helm.toolkit.fluxcd.io", Version: "v2", Resource: "helmreleases"}
	fluxHelmChartGVR     = schema.GroupVersionResource{Group: "source.toolkit.fluxcd.io", Version: "v1beta2", Resource: "helmcharts"}
	fluxAlertGVR         = schema.GroupVersionResource{Group: "notification.toolkit.fluxcd.io", Version: "v1beta3", Resource: "alerts"}
	fluxReceiverGVR      = schema.GroupVersionResource{Group: "notification.toolkit.fluxcd.io", Version: "v1", Resource: "receivers"}
	fluxBucketGVR        = schema.GroupVersionResource{Group: "source.toolkit.fluxcd.io", Version: "v1beta2", Resource: "buckets"}
)

func fluxList(c *gin.Context, h *Handler, gvr schema.GroupVersionResource) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	p := parseListParams(c)
	ns := p.Namespace
	if ns == "" {
		ns = c.DefaultQuery("namespace", "")
	}
	list, err := client.DynamicClient.Resource(gvr).Namespace(ns).List(c.Request.Context(), listOptions(p))
	if err != nil {
		Fail(c, http.StatusInternalServerError, "Flux resource unavailable: "+err.Error())
		return
	}
	filtered := filterUnstructured(list.Items, p.Search)
	total := len(filtered)
	offset, limit := paginate(total, p.Page, p.PageSize)
	end := offset + limit
	if end > total {
		end = total
	}
	OKList(c, filtered[offset:end], total, p.Page, p.PageSize)
}

func (h *Handler) ListFluxGitRepos(c *gin.Context)       { fluxList(c, h, fluxGitRepoGVR) }
func (h *Handler) ListFluxHelmRepos(c *gin.Context)      { fluxList(c, h, fluxHelmRepoGVR) }
func (h *Handler) ListFluxOCIRepos(c *gin.Context)       { fluxList(c, h, fluxOCIRepoGVR) }
func (h *Handler) ListFluxKustomizations(c *gin.Context) { fluxList(c, h, fluxKustomizationGVR) }
func (h *Handler) ListFluxHelmReleases(c *gin.Context)   { fluxList(c, h, fluxHelmReleaseGVR) }
func (h *Handler) ListFluxHelmCharts(c *gin.Context)     { fluxList(c, h, fluxHelmChartGVR) }
func (h *Handler) ListFluxAlerts(c *gin.Context)         { fluxList(c, h, fluxAlertGVR) }
func (h *Handler) ListFluxReceivers(c *gin.Context)      { fluxList(c, h, fluxReceiverGVR) }
func (h *Handler) ListFluxBuckets(c *gin.Context)        { fluxList(c, h, fluxBucketGVR) }

func (h *Handler) GetFluxResource(c *gin.Context) {
	gvrStr := c.Param("resource")
	ns     := c.Param("namespace")
	name   := c.Param("name")

	gvrMap := map[string]schema.GroupVersionResource{
		"gitrepositories":   fluxGitRepoGVR,
		"helmrepositories":  fluxHelmRepoGVR,
		"ocirepositories":   fluxOCIRepoGVR,
		"kustomizations":    fluxKustomizationGVR,
		"helmreleases":      fluxHelmReleaseGVR,
		"helmcharts":        fluxHelmChartGVR,
		"alerts":            fluxAlertGVR,
		"receivers":         fluxReceiverGVR,
		"buckets":           fluxBucketGVR,
	}
	gvr, ok := gvrMap[gvrStr]
	if !ok {
		Fail(c, http.StatusBadRequest, "unknown Flux resource: "+gvrStr)
		return
	}

	client, ok2 := h.client(c)
	if !ok2 {
		return
	}

	obj, err := client.DynamicClient.Resource(gvr).Namespace(ns).Get(
		c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	OK(c, obj)
}
