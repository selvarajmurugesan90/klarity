package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// ClusterHealthReport generates a self-contained HTML report of cluster state
func (h *Handler) ClusterHealthReport(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	ctx := c.Request.Context()

	version, _ := client.GetServerVersion()
	nodes, _ := client.Clientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	pods, _ := client.Clientset.CoreV1().Pods("").List(ctx, metav1.ListOptions{})
	events, _ := client.Clientset.CoreV1().Events("").List(ctx, metav1.ListOptions{
		FieldSelector: "type=Warning",
	})
	deployments, _ := client.Clientset.AppsV1().Deployments("").List(ctx, metav1.ListOptions{})
	namespaces, _ := client.Clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})

	// Count pod phases
	var running, pending, failed int
	for _, p := range pods.Items {
		switch p.Status.Phase {
		case corev1.PodRunning:
			running++
		case corev1.PodPending:
			pending++
		case corev1.PodFailed:
			failed++
		}
	}

	// Count ready nodes
	var readyNodes, notReadyNodes int
	for _, n := range nodes.Items {
		for _, cond := range n.Status.Conditions {
			if cond.Type == corev1.NodeReady {
				if cond.Status == corev1.ConditionTrue {
					readyNodes++
				} else {
					notReadyNodes++
				}
			}
		}
	}

	// Count deployment availability
	var availDeps, unavailDeps int
	for _, d := range deployments.Items {
		if d.Spec.Replicas != nil && d.Status.AvailableReplicas == *d.Spec.Replicas {
			availDeps++
		} else {
			unavailDeps++
		}
	}

	// Recent warning events
	recentEvents := events.Items
	if len(recentEvents) > 20 {
		recentEvents = recentEvents[len(recentEvents)-20:]
	}

	// Determine overall health
	healthColor := "#22c55e"
	healthLabel := "Healthy"
	if notReadyNodes > 0 || failed > 0 || unavailDeps > 0 {
		healthColor = "#f59e0b"
		healthLabel = "Degraded"
	}
	if notReadyNodes > readyNodes {
		healthColor = "#ef4444"
		healthLabel = "Critical"
	}

	// Node rows
	var nodeRows strings.Builder
	for _, n := range nodes.Items {
		ready := "✅ Ready"
		for _, cond := range n.Status.Conditions {
			if cond.Type == corev1.NodeReady && cond.Status != corev1.ConditionTrue {
				ready = "❌ NotReady"
			}
		}
		kubelet := n.Status.NodeInfo.KubeletVersion
		os := n.Status.NodeInfo.OSImage
		cpu := n.Status.Capacity.Cpu().String()
		mem := n.Status.Capacity.Memory().String()
		nodeRows.WriteString(fmt.Sprintf(`<tr><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>`,
			n.Name, ready, kubelet, os, cpu, mem))
	}

	// Warning event rows
	var eventRows strings.Builder
	for _, ev := range recentEvents {
		eventRows.WriteString(fmt.Sprintf(`<tr><td>%s</td><td>%s</td><td>%s/%s</td><td>%s</td><td>%d</td></tr>`,
			ev.Namespace, ev.Reason,
			ev.InvolvedObject.Kind, ev.InvolvedObject.Name,
			truncateStr(ev.Message, 80), ev.Count))
	}

	// Namespace list
	var nsItems strings.Builder
	for _, ns := range namespaces.Items {
		nsItems.WriteString(fmt.Sprintf(`<span class="ns-badge">%s</span>`, ns.Name))
	}

	html := fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cluster Health Report — %s</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; color: #1e293b; }
  .header { background: #0f172a; color: white; padding: 24px 40px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 22px; font-weight: 700; }
  .header .meta { font-size: 13px; color: #94a3b8; }
  .container { max-width: 1200px; margin: 0 auto; padding: 32px 24px; }
  .health-banner { background: %s; color: white; padding: 16px 24px; border-radius: 12px; margin-bottom: 24px; font-size: 18px; font-weight: 700; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
  .card { background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; }
  .card .label { font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em; margin-bottom: 8px; }
  .card .value { font-size: 32px; font-weight: 700; color: #0f172a; }
  .card .sub { font-size: 12px; color: #94a3b8; margin-top: 4px; }
  .section { background: white; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 24px; overflow: hidden; }
  .section-header { padding: 16px 20px; border-bottom: 1px solid #e2e8f0; font-weight: 700; font-size: 15px; background: #f8fafc; }
  table { width: 100%%; border-collapse: collapse; }
  th { background: #f1f5f9; text-align: left; padding: 10px 16px; font-size: 12px; color: #475569; text-transform: uppercase; font-weight: 600; }
  td { padding: 10px 16px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
  tr:last-child td { border-bottom: none; }
  .ns-badge { display: inline-block; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; border-radius: 999px; padding: 3px 10px; font-size: 12px; margin: 3px; }
  .ns-wrap { padding: 16px; }
  .footer { text-align: center; font-size: 12px; color: #94a3b8; margin-top: 32px; padding-bottom: 32px; }
  @media print { body { background: white; } .section { break-inside: avoid; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>⎈ Kubernetes Cluster Health Report</h1>
    <div class="meta">Generated %s · Server %s · %d API Resources</div>
  </div>
  <div class="meta" style="text-align:right">Klarity<br>Apache 2.0</div>
</div>

<div class="container">

<div class="health-banner">%s %s</div>

<div class="grid">
  <div class="card">
    <div class="label">Nodes</div>
    <div class="value">%d</div>
    <div class="sub">%d ready · %d not ready</div>
  </div>
  <div class="card">
    <div class="label">Namespaces</div>
    <div class="value">%d</div>
  </div>
  <div class="card">
    <div class="label">Pods</div>
    <div class="value">%d</div>
    <div class="sub">%d running · %d pending · %d failed</div>
  </div>
  <div class="card">
    <div class="label">Deployments</div>
    <div class="value">%d</div>
    <div class="sub">%d available · %d unavailable</div>
  </div>
  <div class="card">
    <div class="label">Warning Events</div>
    <div class="value" style="color:%s">%d</div>
  </div>
</div>

<div class="section">
  <div class="section-header">🖥 Nodes</div>
  <table>
    <thead><tr><th>Name</th><th>Status</th><th>Kubelet</th><th>OS</th><th>CPU</th><th>Memory</th></tr></thead>
    <tbody>%s</tbody>
  </table>
</div>

<div class="section">
  <div class="section-header">⚠️ Recent Warning Events</div>
  <table>
    <thead><tr><th>Namespace</th><th>Reason</th><th>Object</th><th>Message</th><th>Count</th></tr></thead>
    <tbody>%s</tbody>
  </table>
</div>

<div class="section">
  <div class="section-header">📦 Namespaces</div>
  <div class="ns-wrap">%s</div>
</div>

</div>
<div class="footer">Report generated by Klarity · Apache 2.0 · github.com/selvarajmurugesan90/klarity</div>
</body>
</html>`,
		// title
		time.Now().Format("2006-01-02"),
		// health banner color
		healthColor,
		// header meta
		time.Now().Format("2006-01-02 15:04:05 UTC"),
		version,
		len(client.GetAPIResources()),
		// health banner content
		func() string {
			if healthLabel == "Healthy" {
				return "✅"
			} else if healthLabel == "Degraded" {
				return "⚠️"
			}
			return "🔴"
		}(),
		"Cluster Status: "+healthLabel,
		// stat cards
		len(nodes.Items), readyNodes, notReadyNodes,
		len(namespaces.Items),
		len(pods.Items), running, pending, failed,
		len(deployments.Items), availDeps, unavailDeps,
		func() string {
			if len(events.Items) > 10 {
				return "#ef4444"
			}
			return "#1e293b"
		}(),
		len(events.Items),
		// tables
		nodeRows.String(),
		eventRows.String(),
		nsItems.String(),
	)

	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="cluster-health-%s.html"`,
		time.Now().Format("20060102-150405")))
	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(html))
}

// DeploymentHistory returns rollout revision history for a deployment
func (h *Handler) DeploymentHistory(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	ns := c.Param("namespace")
	name := c.Param("name")
	ctx := c.Request.Context()

	// Get the deployment to extract its selector
	dep, err := client.Clientset.AppsV1().Deployments(ns).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}

	// List all ReplicaSets in the namespace and filter by owner
	rsList, err := client.Clientset.AppsV1().ReplicaSets(ns).List(ctx, metav1.ListOptions{})
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	type RevisionEntry struct {
		Revision    string            `json:"revision"`
		Images      []string          `json:"images"`
		Replicas    int32             `json:"replicas"`
		Age         string            `json:"age"`
		RSName      string            `json:"replicaSetName"`
		Annotations map[string]string `json:"annotations"`
		IsCurrent   bool              `json:"isCurrent"`
	}

	currentRevision := dep.Annotations["deployment.kubernetes.io/revision"]
	var revisions []RevisionEntry

	for _, rs := range rsList.Items {
		// Check if owned by this deployment
		isOwned := false
		for _, ref := range rs.OwnerReferences {
			if ref.Kind == "Deployment" && ref.Name == name {
				isOwned = true
				break
			}
		}
		if !isOwned {
			continue
		}

		rev := rs.Annotations["deployment.kubernetes.io/revision"]
		images := make([]string, 0)
		for _, c := range rs.Spec.Template.Spec.Containers {
			images = append(images, c.Image)
		}

		revisions = append(revisions, RevisionEntry{
			Revision:    rev,
			Images:      images,
			Replicas:    *rs.Spec.Replicas,
			Age:         formatAgeTime(rs.CreationTimestamp.Time),
			RSName:      rs.Name,
			Annotations: rs.Annotations,
			IsCurrent:   rev == currentRevision,
		})
	}

	OK(c, gin.H{
		"deployment": name,
		"namespace":  ns,
		"current":    currentRevision,
		"history":    revisions,
	})
}

// RollbackDeployment rolls back to a specific revision
func (h *Handler) RollbackDeployment(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	ns := c.Param("namespace")
	name := c.Param("name")

	var body struct {
		Revision string `json:"revision"`
		RSName   string `json:"replicaSetName"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	ctx := c.Request.Context()

	if body.RSName == "" {
		Fail(c, http.StatusBadRequest, "replicaSetName is required")
		return
	}

	// Get the target ReplicaSet's pod template
	rs, err := client.Clientset.AppsV1().ReplicaSets(ns).Get(ctx, body.RSName, metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, "ReplicaSet not found: "+err.Error())
		return
	}

	// Get the current deployment
	dep, err := client.Clientset.AppsV1().Deployments(ns).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}

	// Patch the deployment spec.template with the historical pod template
	dep.Spec.Template.Spec = rs.Spec.Template.Spec
	if dep.Annotations == nil {
		dep.Annotations = map[string]string{}
	}
	dep.Annotations["kubernetes.io/change-cause"] = fmt.Sprintf("Rollback to revision %s via Klarity", body.Revision)

	result, err := client.Clientset.AppsV1().Deployments(ns).Update(ctx, dep, metav1.UpdateOptions{})
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	OK(c, gin.H{
		"message":   fmt.Sprintf("Rolled back to revision %s", body.Revision),
		"deployment": result.Name,
	})
}

func truncateStr(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
