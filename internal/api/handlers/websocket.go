package handlers

import (
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/tools/remotecommand"
)

var upgrader = websocket.Upgrader{
	CheckOrigin:     func(r *http.Request) bool { return true },
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
}

// WSLogs streams pod logs over WebSocket
// GET /ws/logs/:namespace/:pod?container=&previous=&timestamps=
func (h *Handler) WSLogs(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	ns := c.Param("namespace")
	pod := c.Param("pod")
	container := c.Query("container")
	previous, _ := strconv.ParseBool(c.DefaultQuery("previous", "false"))
	timestamps, _ := strconv.ParseBool(c.DefaultQuery("timestamps", "false"))

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		h.Log.Errorf("ws log upgrade: %v", err)
		return
	}
	defer conn.Close()

	tailLines := int64(100)
	opts := &corev1.PodLogOptions{
		Container:  container,
		Follow:     true,
		Previous:   previous,
		Timestamps: timestamps,
		TailLines:  &tailLines,
	}

	req := client.Clientset.CoreV1().Pods(ns).GetLogs(pod, opts)
	stream, err := req.Stream(c.Request.Context())
	if err != nil {
		_ = conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("ERROR: %v", err)))
		return
	}
	defer stream.Close()

	buf := make([]byte, 4096)
	for {
		n, err := stream.Read(buf)
		if n > 0 {
			if werr := conn.WriteMessage(websocket.TextMessage, buf[:n]); werr != nil {
				break
			}
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			_ = conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("ERROR: %v", err)))
			break
		}
	}
}

// WSExec opens a WebSocket exec session into a container
// GET /ws/exec/:namespace/:pod/:container
func (h *Handler) WSExec(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	ns := c.Param("namespace")
	pod := c.Param("pod")
	container := c.Param("container")
	shell := c.DefaultQuery("shell", "sh")

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		h.Log.Errorf("ws exec upgrade: %v", err)
		return
	}
	defer conn.Close()

	wsStream := &wsReadWriter{conn: conn, sizeQueue: make(chan remotecommand.TerminalSize, 1)}

	execReq := client.Clientset.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(pod).
		Namespace(ns).
		SubResource("exec").
		VersionedParams(&corev1.PodExecOptions{
			Container: container,
			Command:   []string{shell},
			Stdin:     true,
			Stdout:    true,
			Stderr:    true,
			TTY:       true,
		}, scheme.ParameterCodec)

	exec, err := remotecommand.NewSPDYExecutor(client.RestConfig, "POST", execReq.URL())
	if err != nil {
		_ = conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("ERROR: %v", err)))
		return
	}

	if err := exec.StreamWithContext(c.Request.Context(), remotecommand.StreamOptions{
		Stdin:             wsStream,
		Stdout:            wsStream,
		Stderr:            wsStream,
		Tty:               true,
		TerminalSizeQueue: wsStream,
	}); err != nil {
		h.Log.Debugf("exec stream ended: %v", err)
	}
}

// WSEvents streams cluster events over WebSocket
func (h *Handler) WSEvents(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	ns := c.DefaultQuery("namespace", "")
	watcher, err := client.Clientset.CoreV1().Events(ns).Watch(c.Request.Context(), metav1.ListOptions{})
	if err != nil {
		_ = conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("ERROR: %v", err)))
		return
	}
	defer watcher.Stop()

	for {
		select {
		case event, ok := <-watcher.ResultChan():
			if !ok {
				return
			}
			data, _ := marshalJSON(event)
			if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
				return
			}
		case <-c.Request.Context().Done():
			return
		}
	}
}

// WSMetrics streams node metrics periodically
func (h *Handler) WSMetrics(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	intervalStr := c.DefaultQuery("interval", "5")
	interval, _ := strconv.Atoi(intervalStr)
	if interval < 5 {
		interval = 5
	}

	ticker := time.NewTicker(time.Duration(interval) * time.Second)
	defer ticker.Stop()

	sendMetrics := func() {
		if client.MetricsClient == nil {
			return
		}
		nodeMetrics, err := client.MetricsClient.MetricsV1beta1().NodeMetricses().List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			return
		}
		data, _ := marshalJSON(gin.H{"type": "nodeMetrics", "data": nodeMetrics.Items})
		_ = conn.WriteMessage(websocket.TextMessage, data)
	}

	sendMetrics()
	for {
		select {
		case <-ticker.C:
			sendMetrics()
		case <-c.Request.Context().Done():
			return
		}
	}
}

type wsReadWriter struct {
	conn      *websocket.Conn
	sizeQueue chan remotecommand.TerminalSize
}

func (w *wsReadWriter) Read(p []byte) (int, error) {
	_, msg, err := w.conn.ReadMessage()
	if err != nil {
		return 0, err
	}
	if len(msg) > 0 && msg[0] == '{' {
		var resize struct {
			Type string `json:"type"`
			Cols uint16 `json:"cols"`
			Rows uint16 `json:"rows"`
		}
		if err := unmarshalJSON(msg, &resize); err == nil && resize.Type == "resize" {
			select {
			case w.sizeQueue <- remotecommand.TerminalSize{Width: resize.Cols, Height: resize.Rows}:
			default:
			}
			return 0, nil
		}
	}
	n := copy(p, msg)
	return n, nil
}

func (w *wsReadWriter) Write(p []byte) (int, error) {
	if err := w.conn.WriteMessage(websocket.TextMessage, p); err != nil {
		return 0, err
	}
	return len(p), nil
}

func (w *wsReadWriter) Next() *remotecommand.TerminalSize {
	size, ok := <-w.sizeQueue
	if !ok {
		return nil
	}
	return &size
}
