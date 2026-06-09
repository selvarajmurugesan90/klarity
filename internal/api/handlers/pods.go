package handlers

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func (h *Handler) ListPods(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	p := parseListParams(c)
	ns := p.Namespace
	if ns == "" {
		ns = c.DefaultQuery("namespace", "")
	}

	list, err := client.Clientset.CoreV1().Pods(ns).List(c.Request.Context(), listOptions(p))
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	var filtered []corev1.Pod
	for _, pod := range list.Items {
		if matchesSearch(pod.Name, p.Search) {
			filtered = append(filtered, pod)
		}
	}
	total := len(filtered)
	offset, limit := paginate(total, p.Page, p.PageSize)
	end := offset + limit
	if end > total {
		end = total
	}
	OKList(c, filtered[offset:end], total, p.Page, p.PageSize)
}

func (h *Handler) GetPod(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	ns := c.Param("namespace")
	name := c.Param("name")
	pod, err := client.Clientset.CoreV1().Pods(ns).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	OK(c, pod)
}

func (h *Handler) DeletePod(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	ns := c.Param("namespace")
	name := c.Param("name")
	if err := client.Clientset.CoreV1().Pods(ns).Delete(c.Request.Context(), name, metav1.DeleteOptions{}); err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, gin.H{"deleted": name})
}

func (h *Handler) GetPodLogs(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	ns := c.Param("namespace")
	name := c.Param("name")
	container := c.Query("container")
	previous, _ := strconv.ParseBool(c.DefaultQuery("previous", "false"))
	timestamps, _ := strconv.ParseBool(c.DefaultQuery("timestamps", "false"))
	tailLines, _ := strconv.ParseInt(c.DefaultQuery("tailLines", "1000"), 10, 64)

	opts := &corev1.PodLogOptions{
		Container:  container,
		Previous:   previous,
		Timestamps: timestamps,
		TailLines:  &tailLines,
	}

	req := client.Clientset.CoreV1().Pods(ns).GetLogs(name, opts)
	stream, err := req.Stream(c.Request.Context())
	if err != nil {
		Fail(c, http.StatusInternalServerError, fmt.Sprintf("failed to stream logs: %v", err))
		return
	}
	defer stream.Close()

	buf := new(bytes.Buffer)
	if _, err := io.Copy(buf, stream); err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.Data(http.StatusOK, "text/plain; charset=utf-8", buf.Bytes())
}

func (h *Handler) GetPodYAML(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	ns := c.Param("namespace")
	name := c.Param("name")
	pod, err := client.Clientset.CoreV1().Pods(ns).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	pod.ManagedFields = nil
	serveYAML(c, pod)
}

func (h *Handler) GetPodEvents(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	ns := c.Param("namespace")
	name := c.Param("name")
	events, err := client.Clientset.CoreV1().Events(ns).List(c.Request.Context(), metav1.ListOptions{
		FieldSelector: fmt.Sprintf("involvedObject.name=%s,involvedObject.kind=Pod", name),
	})
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, events.Items)
}
