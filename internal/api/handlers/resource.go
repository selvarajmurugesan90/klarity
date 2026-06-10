package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/selvarajmurugesan90/klarity/internal/k8s"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/yaml"
)

// Apply handles generic resource creation/update from YAML or JSON.
// It discovers the GVR from the resource's apiVersion+kind automatically.
func (h *Handler) Apply(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	body, err := c.GetRawData()
	if err != nil {
		Fail(c, http.StatusBadRequest, "failed to read request body")
		return
	}

	// Support both YAML and JSON
	jsonData, err := yaml.YAMLToJSON(body)
	if err != nil {
		Fail(c, http.StatusBadRequest, "invalid YAML/JSON: "+err.Error())
		return
	}

	obj := &unstructured.Unstructured{}
	if err := json.Unmarshal(jsonData, obj); err != nil {
		Fail(c, http.StatusBadRequest, "failed to parse resource: "+err.Error())
		return
	}

	result, err := serverSideApply(c.Request.Context(), client, obj)
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, result)
}

// serverSideApply applies a resource using server-side apply (SSA) with dynamic client.
// It auto-discovers the GVR from apiVersion+kind via the cluster's discovery cache.
func serverSideApply(ctx context.Context, client *k8s.Client, obj *unstructured.Unstructured) (interface{}, error) {
	gvr, err := resolveGVR(client, obj)
	if err != nil {
		return nil, fmt.Errorf("resolve GVR: %w", err)
	}

	ns := obj.GetNamespace()
	name := obj.GetName()

	data, err := json.Marshal(obj)
	if err != nil {
		return nil, err
	}

	var result *unstructured.Unstructured
	if ns != "" {
		result, err = client.DynamicClient.Resource(gvr).Namespace(ns).Patch(
			ctx, name, types.ApplyPatchType, data,
			metav1.PatchOptions{FieldManager: "klarity", Force: boolPtr(true)},
		)
	} else {
		result, err = client.DynamicClient.Resource(gvr).Patch(
			ctx, name, types.ApplyPatchType, data,
			metav1.PatchOptions{FieldManager: "klarity", Force: boolPtr(true)},
		)
	}
	if err != nil {
		return nil, fmt.Errorf("apply: %w", err)
	}
	return result, nil
}

// resolveGVR finds the GroupVersionResource for an unstructured object by
// matching its apiVersion+kind against the cluster's discovered resource list.
func resolveGVR(client *k8s.Client, obj *unstructured.Unstructured) (schema.GroupVersionResource, error) {
	apiVersion := obj.GetAPIVersion()
	kind := obj.GetKind()

	gv, err := schema.ParseGroupVersion(apiVersion)
	if err != nil {
		return schema.GroupVersionResource{}, fmt.Errorf("parse apiVersion %q: %w", apiVersion, err)
	}

	resources := client.GetAPIResources()
	for _, r := range resources {
		if r.Group == gv.Group && r.Version == gv.Version && strings.EqualFold(r.Kind, kind) {
			return schema.GroupVersionResource{Group: r.Group, Version: r.Version, Resource: r.Resource}, nil
		}
	}
	return schema.GroupVersionResource{}, fmt.Errorf("resource not found for apiVersion=%s kind=%s", apiVersion, kind)
}

// Delete handles generic resource deletion by GVK from query params
func (h *Handler) Delete(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	group := c.Query("group")
	version := c.Query("version")
	resource := c.Query("resource")
	namespace := c.Query("namespace")
	name := c.Query("name")

	if version == "" || resource == "" || name == "" {
		Fail(c, http.StatusBadRequest, "version, resource and name are required")
		return
	}

	gvr := schema.GroupVersionResource{Group: group, Version: version, Resource: resource}
	var err error
	if namespace != "" {
		err = client.DynamicClient.Resource(gvr).Namespace(namespace).Delete(
			c.Request.Context(), name, metav1.DeleteOptions{})
	} else {
		err = client.DynamicClient.Resource(gvr).Delete(
			c.Request.Context(), name, metav1.DeleteOptions{})
	}
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, gin.H{"deleted": name})
}

// PatchResource applies a JSON merge patch or strategic merge patch
func (h *Handler) PatchResource(c *gin.Context) {
	client, ok := h.client(c)
	if !ok {
		return
	}
	group := c.Query("group")
	version := c.Query("version")
	resource := c.Query("resource")
	namespace := c.Query("namespace")
	name := c.Query("name")
	patchType := c.DefaultQuery("patchType", "merge")

	body, err := c.GetRawData()
	if err != nil {
		Fail(c, http.StatusBadRequest, "failed to read body")
		return
	}

	gvr := schema.GroupVersionResource{Group: group, Version: version, Resource: resource}
	var pt types.PatchType
	switch patchType {
	case "strategic":
		pt = types.StrategicMergePatchType
	case "json":
		pt = types.JSONPatchType
	default:
		pt = types.MergePatchType
	}

	var result *unstructured.Unstructured
	if namespace != "" {
		result, err = client.DynamicClient.Resource(gvr).Namespace(namespace).Patch(
			c.Request.Context(), name, pt, body, metav1.PatchOptions{FieldManager: "klarity"})
	} else {
		result, err = client.DynamicClient.Resource(gvr).Patch(
			c.Request.Context(), name, pt, body, metav1.PatchOptions{FieldManager: "klarity"})
	}
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	OK(c, result)
}

func boolPtr(b bool) *bool { return &b }
