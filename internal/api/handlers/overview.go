package handlers

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/selvarajmurugesan90/klarity/internal/k8s"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type ClusterOverview struct {
	ServerVersion     string          `json:"serverVersion"`
	Nodes             NodeSummary     `json:"nodes"`
	Namespaces        int             `json:"namespaces"`
	Pods              PodSummary      `json:"pods"`
	Deployments       WorkloadSummary `json:"deployments"`
	StatefulSets      WorkloadSummary `json:"statefulSets"`
	DaemonSets        WorkloadSummary `json:"daemonSets"`
	Jobs              WorkloadSummary `json:"jobs"`
	Services          int             `json:"services"`
	PersistentVolumes int             `json:"persistentVolumes"`
	APIResources      int             `json:"apiResources"`
	RecentEvents      []EventSummary  `json:"recentEvents"`
}

type NodeSummary struct {
	Total    int `json:"total"`
	Ready    int `json:"ready"`
	NotReady int `json:"notReady"`
}

type PodSummary struct {
	Total     int `json:"total"`
	Running   int `json:"running"`
	Pending   int `json:"pending"`
	Succeeded int `json:"succeeded"`
	Failed    int `json:"failed"`
	Unknown   int `json:"unknown"`
}

type WorkloadSummary struct {
	Total     int `json:"total"`
	Available int `json:"available"`
}

type EventSummary struct {
	Namespace string `json:"namespace"`
	Name      string `json:"name"`
	Reason    string `json:"reason"`
	Message   string `json:"message"`
	Type      string `json:"type"`
	Object    string `json:"object"`
	Count     int32  `json:"count"`
	LastSeen  string `json:"lastSeen"`
}

func (h *Handler) GetOverview(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	ctx := c.Request.Context()
	overview := ClusterOverview{}

	if v, err := client.GetServerVersion(); err == nil {
		overview.ServerVersion = v
	}
	overview.APIResources = len(client.GetAPIResources())

	if nodes, err := client.Clientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{}); err == nil {
		overview.Nodes.Total = len(nodes.Items)
		for _, n := range nodes.Items {
			for _, cond := range n.Status.Conditions {
				if cond.Type == corev1.NodeReady {
					if cond.Status == corev1.ConditionTrue {
						overview.Nodes.Ready++
					} else {
						overview.Nodes.NotReady++
					}
				}
			}
		}
	}

	if ns, err := client.Clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{}); err == nil {
		overview.Namespaces = len(ns.Items)
	}

	if pods, err := client.Clientset.CoreV1().Pods("").List(ctx, metav1.ListOptions{}); err == nil {
		overview.Pods.Total = len(pods.Items)
		for _, p := range pods.Items {
			switch p.Status.Phase {
			case corev1.PodRunning:
				overview.Pods.Running++
			case corev1.PodPending:
				overview.Pods.Pending++
			case corev1.PodSucceeded:
				overview.Pods.Succeeded++
			case corev1.PodFailed:
				overview.Pods.Failed++
			default:
				overview.Pods.Unknown++
			}
		}
	}

	if deps, err := client.Clientset.AppsV1().Deployments("").List(ctx, metav1.ListOptions{}); err == nil {
		overview.Deployments.Total = len(deps.Items)
		for _, d := range deps.Items {
			if d.Spec.Replicas != nil && d.Status.AvailableReplicas == *d.Spec.Replicas {
				overview.Deployments.Available++
			}
		}
	}

	if ss, err := client.Clientset.AppsV1().StatefulSets("").List(ctx, metav1.ListOptions{}); err == nil {
		overview.StatefulSets.Total = len(ss.Items)
		for _, s := range ss.Items {
			if s.Spec.Replicas != nil && s.Status.ReadyReplicas == *s.Spec.Replicas {
				overview.StatefulSets.Available++
			}
		}
	}

	if ds, err := client.Clientset.AppsV1().DaemonSets("").List(ctx, metav1.ListOptions{}); err == nil {
		overview.DaemonSets.Total = len(ds.Items)
		for _, d := range ds.Items {
			if d.Status.NumberReady == d.Status.DesiredNumberScheduled {
				overview.DaemonSets.Available++
			}
		}
	}

	if jobs, err := client.Clientset.BatchV1().Jobs("").List(ctx, metav1.ListOptions{}); err == nil {
		overview.Jobs.Total = len(jobs.Items)
		for _, j := range jobs.Items {
			if j.Status.Succeeded > 0 {
				overview.Jobs.Available++
			}
		}
	}

	if svcs, err := client.Clientset.CoreV1().Services("").List(ctx, metav1.ListOptions{}); err == nil {
		overview.Services = len(svcs.Items)
	}

	if pvs, err := client.Clientset.CoreV1().PersistentVolumes().List(ctx, metav1.ListOptions{}); err == nil {
		overview.PersistentVolumes = len(pvs.Items)
	}

	overview.RecentEvents = recentWarningEvents(ctx, client)
	OK(c, overview)
}

func recentWarningEvents(ctx context.Context, client *k8s.Client) []EventSummary {
	events, err := client.Clientset.CoreV1().Events("").List(ctx, metav1.ListOptions{
		FieldSelector: "type=Warning",
	})
	if err != nil {
		return nil
	}
	items := events.Items
	limit := 20
	if len(items) < limit {
		limit = len(items)
	}
	result := make([]EventSummary, 0, limit)
	for i := len(items) - 1; i >= 0 && len(result) < limit; i-- {
		ev := items[i]
		result = append(result, EventSummary{
			Namespace: ev.Namespace,
			Name:      ev.Name,
			Reason:    ev.Reason,
			Message:   ev.Message,
			Type:      ev.Type,
			Object:    ev.InvolvedObject.Kind + "/" + ev.InvolvedObject.Name,
			Count:     ev.Count,
			LastSeen:  ev.LastTimestamp.Format("2006-01-02T15:04:05Z"),
		})
	}
	return result
}
