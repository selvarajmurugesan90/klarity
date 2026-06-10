package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"sigs.k8s.io/yaml"
)

// GetAPIResources lists every discovered API resource from the cluster
func (h *Handler) GetAPIResources(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	OK(c, client.GetAPIResources())
}

// GetAPIGroups returns all API groups from the cluster
func (h *Handler) GetAPIGroups(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	groups, err := client.ServerGroups()
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, groups)
}

// ListDynamic lists resources of any type using the dynamic client.
// Cluster-scoped: GET /api/v1/dynamic/:group/:version/:resource
// Namespace-scoped: GET /api/v1/dynamic/:group/:version/namespaces/:namespace/:resource
func (h *Handler) ListDynamic(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	gvr, ns := gvrFromContext(c)
	p := parseListParams(c)

	var items []unstructured.Unstructured
	var total int
	var err error

	if ns != "" {
		list, e := client.DynamicClient.Resource(gvr).Namespace(ns).List(c.Request.Context(), listOptions(p))
		err = e
		if list != nil {
			items = filterUnstructured(list.Items, p.Search)
		}
	} else {
		list, e := client.DynamicClient.Resource(gvr).List(c.Request.Context(), listOptions(p))
		err = e
		if list != nil {
			items = filterUnstructured(list.Items, p.Search)
		}
	}

	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	total = len(items)
	offset, limit := paginate(total, p.Page, p.PageSize)
	end := offset + limit
	if end > total {
		end = total
	}
	OKList(c, items[offset:end], total, p.Page, p.PageSize)
}

// GetDynamic retrieves a single resource of any type
func (h *Handler) GetDynamic(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	gvr, ns := gvrFromContext(c)
	name := c.Param("name")

	var obj *unstructured.Unstructured
	var err error
	if ns != "" {
		obj, err = client.DynamicClient.Resource(gvr).Namespace(ns).Get(c.Request.Context(), name, metav1.GetOptions{})
	} else {
		obj, err = client.DynamicClient.Resource(gvr).Get(c.Request.Context(), name, metav1.GetOptions{})
	}
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}
	OK(c, obj)
}

// DeleteDynamic deletes a resource of any type
func (h *Handler) DeleteDynamic(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	gvr, ns := gvrFromContext(c)
	name := c.Param("name")

	var err error
	if ns != "" {
		err = client.DynamicClient.Resource(gvr).Namespace(ns).Delete(c.Request.Context(), name, metav1.DeleteOptions{})
	} else {
		err = client.DynamicClient.Resource(gvr).Delete(c.Request.Context(), name, metav1.DeleteOptions{})
	}
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, gin.H{"deleted": name})
}

// GetDynamicYAML returns the resource serialized as YAML
func (h *Handler) GetDynamicYAML(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	gvr, ns := gvrFromContext(c)
	name := c.Param("name")

	var obj *unstructured.Unstructured
	var err error
	if ns != "" {
		obj, err = client.DynamicClient.Resource(gvr).Namespace(ns).Get(c.Request.Context(), name, metav1.GetOptions{})
	} else {
		obj, err = client.DynamicClient.Resource(gvr).Get(c.Request.Context(), name, metav1.GetOptions{})
	}
	if err != nil {
		Fail(c, http.StatusNotFound, err.Error())
		return
	}

	// Strip managed fields for cleaner output
	obj.SetManagedFields(nil)
	yamlBytes, err := yaml.Marshal(obj.Object)
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.Data(http.StatusOK, "application/yaml", yamlBytes)
}

// gvrFromContext extracts GroupVersionResource and namespace from gin path params
func gvrFromContext(c *gin.Context) (schema.GroupVersionResource, string) {
	group := c.Param("group")
	if group == "core" || group == "_" {
		group = ""
	}
	return schema.GroupVersionResource{
		Group:    group,
		Version:  c.Param("version"),
		Resource: c.Param("resource"),
	}, c.Param("namespace")
}

func filterUnstructured(items []unstructured.Unstructured, search string) []unstructured.Unstructured {
	if search == "" {
		return items
	}
	search = strings.ToLower(search)
	var filtered []unstructured.Unstructured
	for _, item := range items {
		if strings.Contains(strings.ToLower(item.GetName()), search) {
			filtered = append(filtered, item)
		}
	}
	return filtered
}
