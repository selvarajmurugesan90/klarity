package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	appsv1 "k8s.io/api/apps/v1"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/yaml"
)

// ─── Deployments ─────────────────────────────────────────────────────────────

func (h *Handler) ListDeployments(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	p := parseListParams(c)
	ns := nsParam(c, p)
	list, err := client.Clientset.AppsV1().Deployments(ns).List(c.Request.Context(), listOptions(p))
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	filtered := filterItems(list.Items, p.Search, func(i int) string { return list.Items[i].Name })
	total := len(filtered)
	OKList(c, pagSlice(filtered, p), total, p.Page, p.PageSize)
}

func (h *Handler) GetDeployment(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	obj, err := client.Clientset.AppsV1().Deployments(c.Param("namespace")).Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	OK(c, obj)
}

func (h *Handler) ScaleDeployment(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	var body struct {
		Replicas int32 `json:"replicas"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	ns, name := c.Param("namespace"), c.Param("name")
	patch := fmt.Sprintf(`{"spec":{"replicas":%d}}`, body.Replicas)
	result, err := client.Clientset.AppsV1().Deployments(ns).Patch(
		c.Request.Context(), name, types.MergePatchType, []byte(patch), metav1.PatchOptions{})
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, result)
}

func (h *Handler) RestartDeployment(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	ns, name := c.Param("namespace"), c.Param("name")
	patch := fmt.Sprintf(`{"spec":{"template":{"metadata":{"annotations":{"kubectl.kubernetes.io/restartedAt":"%s"}}}}}`,
		time.Now().UTC().Format(time.RFC3339))
	result, err := client.Clientset.AppsV1().Deployments(ns).Patch(
		c.Request.Context(), name, types.MergePatchType, []byte(patch), metav1.PatchOptions{})
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, result)
}

func (h *Handler) DeleteDeployment(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	if err := client.Clientset.AppsV1().Deployments(c.Param("namespace")).Delete(
		c.Request.Context(), c.Param("name"), metav1.DeleteOptions{}); err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, gin.H{"deleted": c.Param("name")})
}

func (h *Handler) GetDeploymentYAML(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	obj, err := client.Clientset.AppsV1().Deployments(c.Param("namespace")).Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	obj.ManagedFields = nil
	serveYAML(c, obj)
}

func (h *Handler) GetDeploymentEvents(c *gin.Context) {
	getResourceEvents(c, h, "Deployment")
}

func (h *Handler) UpdateDeployment(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	body, err := c.GetRawData()
	if err != nil {
		Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	jsonData, err := yaml.YAMLToJSON(body)
	if err != nil {
		Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	var dep appsv1.Deployment
	if err := json.Unmarshal(jsonData, &dep); err != nil {
		Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	result, err := client.Clientset.AppsV1().Deployments(c.Param("namespace")).Update(
		c.Request.Context(), &dep, metav1.UpdateOptions{})
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, result)
}

// ─── StatefulSets ─────────────────────────────────────────────────────────────

func (h *Handler) ListStatefulSets(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	p := parseListParams(c)
	list, err := client.Clientset.AppsV1().StatefulSets(nsParam(c, p)).List(c.Request.Context(), listOptions(p))
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	filtered := filterItems(list.Items, p.Search, func(i int) string { return list.Items[i].Name })
	OKList(c, pagSlice(filtered, p), len(filtered), p.Page, p.PageSize)
}

func (h *Handler) GetStatefulSet(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	obj, err := client.Clientset.AppsV1().StatefulSets(c.Param("namespace")).Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	OK(c, obj)
}

func (h *Handler) ScaleStatefulSet(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	var body struct{ Replicas int32 `json:"replicas"` }
	if err := c.ShouldBindJSON(&body); err != nil {
		Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	patch := fmt.Sprintf(`{"spec":{"replicas":%d}}`, body.Replicas)
	result, err := client.Clientset.AppsV1().StatefulSets(c.Param("namespace")).Patch(
		c.Request.Context(), c.Param("name"), types.MergePatchType, []byte(patch), metav1.PatchOptions{})
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, result)
}

func (h *Handler) DeleteStatefulSet(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	if err := client.Clientset.AppsV1().StatefulSets(c.Param("namespace")).Delete(
		c.Request.Context(), c.Param("name"), metav1.DeleteOptions{}); err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, gin.H{"deleted": c.Param("name")})
}

func (h *Handler) GetStatefulSetYAML(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	obj, err := client.Clientset.AppsV1().StatefulSets(c.Param("namespace")).Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	obj.ManagedFields = nil
	serveYAML(c, obj)
}

// ─── DaemonSets ───────────────────────────────────────────────────────────────

func (h *Handler) ListDaemonSets(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	p := parseListParams(c)
	list, err := client.Clientset.AppsV1().DaemonSets(nsParam(c, p)).List(c.Request.Context(), listOptions(p))
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	filtered := filterItems(list.Items, p.Search, func(i int) string { return list.Items[i].Name })
	OKList(c, pagSlice(filtered, p), len(filtered), p.Page, p.PageSize)
}

func (h *Handler) GetDaemonSet(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	obj, err := client.Clientset.AppsV1().DaemonSets(c.Param("namespace")).Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	OK(c, obj)
}

func (h *Handler) DeleteDaemonSet(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	if err := client.Clientset.AppsV1().DaemonSets(c.Param("namespace")).Delete(
		c.Request.Context(), c.Param("name"), metav1.DeleteOptions{}); err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, gin.H{"deleted": c.Param("name")})
}

func (h *Handler) GetDaemonSetYAML(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	obj, err := client.Clientset.AppsV1().DaemonSets(c.Param("namespace")).Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	obj.ManagedFields = nil
	serveYAML(c, obj)
}

// ─── ReplicaSets ──────────────────────────────────────────────────────────────

func (h *Handler) ListReplicaSets(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	p := parseListParams(c)
	list, err := client.Clientset.AppsV1().ReplicaSets(nsParam(c, p)).List(c.Request.Context(), listOptions(p))
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	filtered := filterItems(list.Items, p.Search, func(i int) string { return list.Items[i].Name })
	OKList(c, pagSlice(filtered, p), len(filtered), p.Page, p.PageSize)
}

func (h *Handler) GetReplicaSet(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	obj, err := client.Clientset.AppsV1().ReplicaSets(c.Param("namespace")).Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	OK(c, obj)
}

func (h *Handler) DeleteReplicaSet(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	if err := client.Clientset.AppsV1().ReplicaSets(c.Param("namespace")).Delete(
		c.Request.Context(), c.Param("name"), metav1.DeleteOptions{}); err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, gin.H{"deleted": c.Param("name")})
}

// ─── ControllerRevisions ──────────────────────────────────────────────────────

func (h *Handler) ListControllerRevisions(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	p := parseListParams(c)
	list, err := client.Clientset.AppsV1().ControllerRevisions(nsParam(c, p)).List(c.Request.Context(), listOptions(p))
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, list.Items)
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

func (h *Handler) ListJobs(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	p := parseListParams(c)
	list, err := client.Clientset.BatchV1().Jobs(nsParam(c, p)).List(c.Request.Context(), listOptions(p))
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	filtered := filterItems(list.Items, p.Search, func(i int) string { return list.Items[i].Name })
	OKList(c, pagSlice(filtered, p), len(filtered), p.Page, p.PageSize)
}

func (h *Handler) GetJob(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	obj, err := client.Clientset.BatchV1().Jobs(c.Param("namespace")).Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	OK(c, obj)
}

func (h *Handler) DeleteJob(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	propagation := metav1.DeletePropagationForeground
	if err := client.Clientset.BatchV1().Jobs(c.Param("namespace")).Delete(
		c.Request.Context(), c.Param("name"),
		metav1.DeleteOptions{PropagationPolicy: &propagation}); err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, gin.H{"deleted": c.Param("name")})
}

func (h *Handler) GetJobYAML(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	obj, err := client.Clientset.BatchV1().Jobs(c.Param("namespace")).Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	obj.ManagedFields = nil
	serveYAML(c, obj)
}

// ─── CronJobs ─────────────────────────────────────────────────────────────────

func (h *Handler) ListCronJobs(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	p := parseListParams(c)
	list, err := client.Clientset.BatchV1().CronJobs(nsParam(c, p)).List(c.Request.Context(), listOptions(p))
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	filtered := filterItems(list.Items, p.Search, func(i int) string { return list.Items[i].Name })
	OKList(c, pagSlice(filtered, p), len(filtered), p.Page, p.PageSize)
}

func (h *Handler) GetCronJob(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	obj, err := client.Clientset.BatchV1().CronJobs(c.Param("namespace")).Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	OK(c, obj)
}

func (h *Handler) DeleteCronJob(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	if err := client.Clientset.BatchV1().CronJobs(c.Param("namespace")).Delete(
		c.Request.Context(), c.Param("name"), metav1.DeleteOptions{}); err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, gin.H{"deleted": c.Param("name")})
}

func (h *Handler) TriggerCronJob(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	ns, name := c.Param("namespace"), c.Param("name")
	cj, err := client.Clientset.BatchV1().CronJobs(ns).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      fmt.Sprintf("%s-manual-%d", name, time.Now().Unix()),
			Namespace: ns,
			Annotations: map[string]string{
				"cronjob.kubernetes.io/instantiate": "manual",
			},
		},
		Spec: cj.Spec.JobTemplate.Spec,
	}
	created, err := client.Clientset.BatchV1().Jobs(ns).Create(c.Request.Context(), job, metav1.CreateOptions{})
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, created)
}

func (h *Handler) SuspendCronJob(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	var body struct{ Suspend bool `json:"suspend"` }
	if err := c.ShouldBindJSON(&body); err != nil {
		Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	patch := fmt.Sprintf(`{"spec":{"suspend":%v}}`, body.Suspend)
	result, err := client.Clientset.BatchV1().CronJobs(c.Param("namespace")).Patch(
		c.Request.Context(), c.Param("name"), types.MergePatchType, []byte(patch), metav1.PatchOptions{})
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, result)
}

// ─── ReplicationControllers ───────────────────────────────────────────────────

func (h *Handler) ListReplicationControllers(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	p := parseListParams(c)
	list, err := client.Clientset.CoreV1().ReplicationControllers(nsParam(c, p)).List(c.Request.Context(), listOptions(p))
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, list.Items)
}

func (h *Handler) GetReplicationController(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	obj, err := client.Clientset.CoreV1().ReplicationControllers(c.Param("namespace")).Get(c.Request.Context(), c.Param("name"), metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	OK(c, obj)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func nsParam(c *gin.Context, p ListParams) string {
	if p.Namespace != "" {
		return p.Namespace
	}
	return c.DefaultQuery("namespace", corev1.NamespaceAll)
}

func filterItems[T any](items []T, search string, name func(int) string) []T {
	if search == "" {
		return items
	}
	var out []T
	for i, item := range items {
		if matchesSearch(name(i), search) {
			out = append(out, item)
		}
	}
	return out
}

func pagSlice[T any](items []T, p ListParams) []T {
	total := len(items)
	offset, limit := paginate(total, p.Page, p.PageSize)
	end := offset + limit
	if end > total {
		end = total
	}
	return items[offset:end]
}

func getResourceEvents(c *gin.Context, h *Handler, kind string) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	ns := c.Param("namespace")
	name := c.Param("name")
	events, err := client.Clientset.CoreV1().Events(ns).List(c.Request.Context(), metav1.ListOptions{
		FieldSelector: fmt.Sprintf("involvedObject.name=%s,involvedObject.kind=%s", name, kind),
	})
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, events.Items)
}

func serveYAML(c *gin.Context, obj interface{}) {
	data, err := yaml.Marshal(obj)
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.Data(http.StatusOK, "application/yaml", data)
}
