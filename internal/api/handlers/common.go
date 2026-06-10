package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"github.com/selvarajmurugesan90/klarity/internal/k8s"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// Handler is the root handler that all sub-handlers embed
type Handler struct {
	Manager  *k8s.Manager
	Log      *logrus.Logger
	authMode string
}

// New creates a Handler. authMode is the server's configured auth mode (none/token/oidc).
func New(mgr *k8s.Manager, log *logrus.Logger, authMode string) *Handler {
	return &Handler{Manager: mgr, Log: log, authMode: authMode}
}

type ListParams struct {
	Namespace     string
	LabelSelector string
	FieldSelector string
	Search        string
	Page          int
	PageSize      int
	SortBy        string
	SortOrder     string
}

type Response struct {
	Success  bool        `json:"success"`
	Data     interface{} `json:"data"`
	Error    *string     `json:"error"`
	Total    int         `json:"total,omitempty"`
	Page     int         `json:"page,omitempty"`
	PageSize int         `json:"pageSize,omitempty"`
}

func OK(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{Success: true, Data: data})
}

func OKList(c *gin.Context, data interface{}, total, page, pageSize int) {
	c.JSON(http.StatusOK, Response{
		Success:  true,
		Data:     data,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	})
}

func Fail(c *gin.Context, status int, msg string) {
	c.JSON(status, Response{Success: false, Error: &msg})
}

func (h *Handler) client(c *gin.Context) (*k8s.Client, bool) {
	clusterName := c.Query("cluster")
	var (
		client *k8s.Client
		err    error
	)
	if clusterName != "" {
		client, err = h.Manager.Get(clusterName)
	} else {
		client, err = h.Manager.Current()
	}
	if err != nil {
		Fail(c, http.StatusServiceUnavailable, "no cluster available: "+err.Error())
		return nil, false
	}
	return client, true
}

func parseListParams(c *gin.Context) ListParams {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "100"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 500 {
		pageSize = 100
	}
	return ListParams{
		Namespace:     c.Param("namespace"),
		LabelSelector: c.Query("labelSelector"),
		FieldSelector: c.Query("fieldSelector"),
		Search:        strings.ToLower(c.Query("search")),
		Page:          page,
		PageSize:      pageSize,
		SortBy:        c.DefaultQuery("sortBy", "name"),
		SortOrder:     c.DefaultQuery("sortOrder", "asc"),
	}
}

func listOptions(p ListParams) metav1.ListOptions {
	return metav1.ListOptions{
		LabelSelector: p.LabelSelector,
		FieldSelector: p.FieldSelector,
	}
}

func matchesSearch(name, search string) bool {
	if search == "" {
		return true
	}
	return strings.Contains(strings.ToLower(name), search)
}

func paginate(total, page, pageSize int) (offset, limit int) {
	offset = (page - 1) * pageSize
	if offset >= total {
		offset = 0
	}
	limit = pageSize
	return
}
