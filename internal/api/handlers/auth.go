package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	authv1 "k8s.io/api/authentication/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// AuthConfig holds the auth mode so the frontend can self-configure
type AuthConfig struct {
	Mode          string `json:"mode"`           // none | token | oidc
	Authenticated bool   `json:"authenticated"`  // always true when mode=none
}

func marshalJSON(v interface{}) ([]byte, error) {
	return json.Marshal(v)
}

func unmarshalJSON(data []byte, v interface{}) error {
	return json.Unmarshal(data, v)
}

// GetAuthConfig returns the server's auth configuration — called by the frontend
// on startup to determine login flow.
func (h *Handler) GetAuthConfig(c *gin.Context) {
	mode := h.authMode
	OK(c, AuthConfig{
		Mode:          mode,
		Authenticated: mode == "none",
		// "internal" = username/password login
		// "token"    = K8s ServiceAccount bearer token
		// "oidc"     = OpenID Connect
		// "none"     = no auth (dev)
	})
}

// CheckAuth returns whether the current request is authenticated
func (h *Handler) CheckAuth(c *gin.Context) {
	token := c.GetString("k8s_token")
	if token == "" && h.authMode == "none" {
		OK(c, gin.H{"authenticated": true, "user": "admin", "mode": "none"})
		return
	}
	if token == "" {
		OK(c, gin.H{"authenticated": false})
		return
	}
	OK(c, gin.H{"authenticated": true, "user": c.GetString("k8s_user"), "mode": h.authMode})
}

// Login validates a token via the TokenReview API
func (h *Handler) Login(c *gin.Context) {
	if h.authMode == "none" {
		OK(c, gin.H{"authenticated": true, "user": "admin", "groups": []string{"system:masters"}})
		return
	}

	var body struct {
		Token string `json:"token"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	client, ok := h.client(c)
	if !ok {
		return
	}

	tr := &authv1.TokenReview{
		Spec: authv1.TokenReviewSpec{Token: body.Token},
	}
	result, err := client.Clientset.AuthenticationV1().TokenReviews().Create(c.Request.Context(), tr, metav1.CreateOptions{})
	if err != nil {
		Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	if !result.Status.Authenticated {
		Fail(c, http.StatusUnauthorized, "invalid token")
		return
	}

	c.SetCookie("kd_token", body.Token, int(24*time.Hour/time.Second), "/", "", false, true)
	OK(c, gin.H{
		"authenticated": true,
		"user":          result.Status.User.Username,
		"groups":        result.Status.User.Groups,
		"mode":          h.authMode,
	})
}

func (h *Handler) Logout(c *gin.Context) {
	c.SetCookie("kd_token", "", -1, "/", "", false, true)
	OK(c, gin.H{"loggedOut": true})
}
