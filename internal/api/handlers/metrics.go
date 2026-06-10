package handlers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type NodeMetricsResponse struct {
	Name       string  `json:"name"`
	CPUUsage   string  `json:"cpuUsage"`    // human-readable e.g. "329m"
	MemUsage   string  `json:"memoryUsage"` // human-readable e.g. "1.08Gi"
	CPUMillis  int64   `json:"cpuMillis"`   // exact milli-cores
	MemBytes   int64   `json:"memBytes"`    // exact bytes
	CPUCores   string  `json:"cpuCapacity"`
	MemTotal   string  `json:"memoryCapacity"`
	CPUPct     float64 `json:"cpuPercent"`
	MemPct     float64 `json:"memoryPercent"`
}

type PodMetricsResponse struct {
	Name       string                   `json:"name"`
	Namespace  string                   `json:"namespace"`
	Containers []ContainerMetricsItem   `json:"containers"`
}

type ContainerMetricsItem struct {
	Name     string `json:"name"`
	CPU      string `json:"cpu"`
	Memory   string `json:"memory"`
}

func (h *Handler) GetNodeMetrics(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	if client.MetricsClient == nil {
		Fail(c, http.StatusServiceUnavailable, "metrics-server not available")
		return
	}
	nodeMetrics, err := client.MetricsClient.MetricsV1beta1().NodeMetricses().List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		Fail(c, http.StatusInternalServerError, "metrics-server unavailable: "+err.Error())
		return
	}

	// Also get node capacities to compute percentages
	nodes, err := client.Clientset.CoreV1().Nodes().List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	capacities := map[string]map[string]int64{}
	for _, n := range nodes.Items {
		cpu := n.Status.Capacity.Cpu().MilliValue()
		mem := n.Status.Capacity.Memory().Value()
		capacities[n.Name] = map[string]int64{"cpu": cpu, "mem": mem}
	}

	result := make([]NodeMetricsResponse, 0, len(nodeMetrics.Items))
	for _, nm := range nodeMetrics.Items {
		cpuUsage := nm.Usage.Cpu().MilliValue()
		memUsage := nm.Usage.Memory().Value()

		var cpuPct, memPct float64
		if cap, ok := capacities[nm.Name]; ok {
			if cap["cpu"] > 0 {
				cpuPct = float64(cpuUsage) / float64(cap["cpu"]) * 100
			}
			if cap["mem"] > 0 {
				memPct = float64(memUsage) / float64(cap["mem"]) * 100
			}
		}

		result = append(result, NodeMetricsResponse{
			Name:      nm.Name,
			CPUUsage:  formatMilliCPU(nm.Usage.Cpu().MilliValue()),
			MemUsage:  formatMemBytes(nm.Usage.Memory().Value()),
			CPUMillis: nm.Usage.Cpu().MilliValue(),
			MemBytes:  nm.Usage.Memory().Value(),
			CPUPct:    cpuPct,
			MemPct:    memPct,
		})
	}
	OK(c, result)
}

func (h *Handler) GetPodMetrics(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	if client.MetricsClient == nil {
		Fail(c, http.StatusServiceUnavailable, "metrics-server not available")
		return
	}
	ns := c.Param("namespace")
	if ns == "" {
		ns = c.DefaultQuery("namespace", "")
	}

	podMetrics, err := client.MetricsClient.MetricsV1beta1().PodMetricses(ns).List(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		Fail(c, http.StatusInternalServerError, "metrics-server unavailable: "+err.Error())
		return
	}

	result := make([]PodMetricsResponse, 0, len(podMetrics.Items))
	for _, pm := range podMetrics.Items {
		containers := make([]ContainerMetricsItem, 0, len(pm.Containers))
		for _, cm := range pm.Containers {
			containers = append(containers, ContainerMetricsItem{
				Name:   cm.Name,
				CPU:    cm.Usage.Cpu().String(),
				Memory: cm.Usage.Memory().String(),
			})
		}
		result = append(result, PodMetricsResponse{
			Name:       pm.Name,
			Namespace:  pm.Namespace,
			Containers: containers,
		})
	}
	OK(c, result)
}

func (h *Handler) GetSinglePodMetrics(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	if client.MetricsClient == nil {
		Fail(c, http.StatusServiceUnavailable, "metrics-server not available")
		return
	}
	ns := c.Param("namespace")
	name := c.Param("name")
	pm, err := client.MetricsClient.MetricsV1beta1().PodMetricses(ns).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	OK(c, pm)
}

func (h *Handler) GetSingleNodeMetrics(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	if client.MetricsClient == nil {
		Fail(c, http.StatusServiceUnavailable, "metrics-server not available")
		return
	}
	nodeName := c.Param("name")
	nm, err := client.MetricsClient.MetricsV1beta1().NodeMetricses().Get(c.Request.Context(), nodeName, metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}

	// Enrich with capacity percentages
	node, err := client.Clientset.CoreV1().Nodes().Get(c.Request.Context(), nodeName, metav1.GetOptions{})
	if err != nil {
		OK(c, nm)
		return
	}

	cpuUsage := nm.Usage.Cpu().MilliValue()
	memUsage := nm.Usage.Memory().Value()
	cpuCap   := node.Status.Capacity.Cpu().MilliValue()
	memCap   := node.Status.Capacity.Memory().Value()

	var cpuPct, memPct float64
	if cpuCap > 0 { cpuPct = float64(cpuUsage) / float64(cpuCap) * 100 }
	if memCap > 0 { memPct = float64(memUsage) / float64(memCap) * 100 }

	OK(c, NodeMetricsResponse{
		Name:      nodeName,
		CPUUsage:  formatMilliCPU(nm.Usage.Cpu().MilliValue()),
		MemUsage:  formatMemBytes(nm.Usage.Memory().Value()),
		CPUMillis: nm.Usage.Cpu().MilliValue(),
		MemBytes:  nm.Usage.Memory().Value(),
		CPUPct:    cpuPct,
		MemPct:    memPct,
	})
}

func (h *Handler) MetricsAvailable(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	available := client.MetricsAvailable(c.Request.Context())
	OK(c, gin.H{"available": available})
}

// PodMetricsSummary is an enriched pod metric entry for the Top Consumers view
type PodMetricsSummary struct {
	Name         string  `json:"name"`
	Namespace    string  `json:"namespace"`
	CPUMillis    int64   `json:"cpuMillis"`    // milli-cores
	MemoryBytes  int64   `json:"memoryBytes"`  // bytes
	CPUDisplay   string  `json:"cpuDisplay"`   // human-readable e.g. "245m"
	MemDisplay   string  `json:"memDisplay"`   // human-readable e.g. "128Mi"
	Containers   int     `json:"containers"`
}

// GetAllPodMetrics returns metrics for ALL pods across all namespaces
// Used by the Top Consumers page and namespace aggregation
func (h *Handler) GetAllPodMetrics(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	if client.MetricsClient == nil {
		Fail(c, http.StatusServiceUnavailable, "metrics-server not available")
		return
	}

	// Empty namespace = all namespaces
	podMetrics, err := client.MetricsClient.MetricsV1beta1().PodMetricses("").List(
		c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		Fail(c, http.StatusInternalServerError, "metrics-server: "+err.Error())
		return
	}

	result := make([]PodMetricsSummary, 0, len(podMetrics.Items))
	for _, pm := range podMetrics.Items {
		var totalCPU, totalMem int64
		for _, cm := range pm.Containers {
			totalCPU += cm.Usage.Cpu().MilliValue()
			totalMem += cm.Usage.Memory().Value()
		}
		result = append(result, PodMetricsSummary{
			Name:        pm.Name,
			Namespace:   pm.Namespace,
			CPUMillis:   totalCPU,
			MemoryBytes: totalMem,
			CPUDisplay:  pm.Containers[0].Usage.Cpu().String(), // approximate; full in containers
			MemDisplay:  formatMemBytes(totalMem),
			Containers:  len(pm.Containers),
		})
	}
	OK(c, gin.H{"data": result, "total": len(result), "success": true})
}

// GetNamespaceMetricsSummary aggregates CPU+Memory usage per namespace
func (h *Handler) GetNamespaceMetricsSummary(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	if client.MetricsClient == nil {
		OK(c, gin.H{"data": []interface{}{}, "total": 0, "success": true})
		return
	}

	podMetrics, err := client.MetricsClient.MetricsV1beta1().PodMetricses("").List(
		c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		OK(c, gin.H{"data": []interface{}{}, "total": 0, "success": true})
		return
	}

	type NsSummary struct {
		Namespace   string `json:"namespace"`
		CPUMillis   int64  `json:"cpuMillis"`
		MemoryBytes int64  `json:"memoryBytes"`
		CPUDisplay  string `json:"cpuDisplay"`
		MemDisplay  string `json:"memDisplay"`
		PodCount    int    `json:"podCount"`
	}

	nsMap := map[string]*NsSummary{}
	for _, pm := range podMetrics.Items {
		ns := pm.Namespace
		if _, ok := nsMap[ns]; !ok {
			nsMap[ns] = &NsSummary{Namespace: ns}
		}
		nsMap[ns].PodCount++
		for _, cm := range pm.Containers {
			nsMap[ns].CPUMillis   += cm.Usage.Cpu().MilliValue()
			nsMap[ns].MemoryBytes += cm.Usage.Memory().Value()
		}
	}

	result := make([]*NsSummary, 0, len(nsMap))
	for _, s := range nsMap {
		s.CPUDisplay = formatMilliCPU(s.CPUMillis)
		s.MemDisplay = formatMemBytes(s.MemoryBytes)
		result = append(result, s)
	}
	OK(c, gin.H{"data": result, "total": len(result), "success": true})
}

func formatMemBytes(b int64) string {
	const (
		Ki = 1024
		Mi = 1024 * Ki
		Gi = 1024 * Mi
	)
	switch {
	case b >= Gi:
		return fmt.Sprintf("%.1fGi", float64(b)/float64(Gi))
	case b >= Mi:
		return fmt.Sprintf("%.0fMi", float64(b)/float64(Mi))
	case b >= Ki:
		return fmt.Sprintf("%.0fKi", float64(b)/float64(Ki))
	default:
		return fmt.Sprintf("%dB", b)
	}
}

func formatMilliCPU(m int64) string {
	if m >= 1000 {
		return fmt.Sprintf("%.2f", float64(m)/1000)
	}
	return fmt.Sprintf("%dm", m)
}
