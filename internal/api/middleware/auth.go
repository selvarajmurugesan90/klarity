package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"github.com/selvarajmurugesan90/klarity/internal/auth"
	"github.com/selvarajmurugesan90/klarity/internal/config"
	"github.com/selvarajmurugesan90/klarity/internal/k8s"
	authv1 "k8s.io/api/authentication/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const UserKey = "k8s_user"
const TokenKey = "k8s_token"
const InternalUserIDKey = "internal_user_id"
const InternalUserRoleKey = "internal_user_role"

// restrictedPaths lists path patterns that only admins/editors can modify
var adminOnlyPaths = []string{
	"/api/v1/users",
	"/api/v1/auth/users",
}

var editorRestrictedPaths = []string{
	"/api/v1/clusterroles",
	"/api/v1/clusterrolebindings",
	"/api/v1/roles",
	"/api/v1/rolebindings",
}

func Auth(
	cfg config.AuthConfig,
	mgr *k8s.Manager,
	log *logrus.Logger,
	userStore *auth.UserStore,
	jwtMgr *auth.JWTManager,
) gin.HandlerFunc {
	var verifier *oidc.IDTokenVerifier
	if cfg.Mode == "oidc" && cfg.OIDC.IssuerURL != "" {
		provider, err := oidc.NewProvider(context.Background(), cfg.OIDC.IssuerURL)
		if err != nil {
			log.Errorf("OIDC provider init failed: %v", err)
		} else {
			verifier = provider.Verifier(&oidc.Config{ClientID: cfg.OIDC.ClientID})
		}
	}

	return func(c *gin.Context) {
		method := c.Request.Method
		path := c.Request.URL.Path

		switch cfg.Mode {
		case "none":
			// No authentication — set synthetic admin role
			c.Set(InternalUserIDKey, "system")
			c.Set(InternalUserRoleKey, string(auth.RoleAdmin))
			c.Set(UserKey, "admin")
			c.Next()
			return

		case "internal":
			// Username/password JWT authentication
			tokenStr := extractToken(c)
			if tokenStr == "" {
				c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "authentication required"})
				c.Abort()
				return
			}

			claims, err := jwtMgr.Validate(tokenStr)
			if err != nil {
				c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "invalid or expired token"})
				c.Abort()
				return
			}

			if claims.TokenType != "access" {
				c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "access token required"})
				c.Abort()
				return
			}

			role := auth.Role(claims.Role)

			// Role-based access control
			if !auth.RoleAllows(role, method) {
				c.JSON(http.StatusForbidden, gin.H{
					"success": false,
					"error":   "your role (" + claims.Role + ") does not have permission to perform this action",
				})
				c.Abort()
				return
			}

			// Editor cannot modify RBAC resources
			if role == auth.RoleEditor && (method == "DELETE" || method == "PUT" || method == "POST" || method == "PATCH") {
				for _, restrictedPath := range editorRestrictedPaths {
					if strings.HasPrefix(path, restrictedPath) {
						c.JSON(http.StatusForbidden, gin.H{
							"success": false,
							"error":   "editors cannot modify RBAC resources",
						})
						c.Abort()
						return
					}
				}
			}

			// Only admin can access user management
			if role != auth.RoleAdmin {
				for _, adminPath := range adminOnlyPaths {
					if strings.HasPrefix(path, adminPath) {
						c.JSON(http.StatusForbidden, gin.H{
							"success": false,
							"error":   "admin access required",
						})
						c.Abort()
						return
					}
				}
			}

			c.Set(InternalUserIDKey, claims.UserID)
			c.Set(InternalUserRoleKey, claims.Role)
			c.Set(UserKey, claims.Username)
			c.Next()
			return

		case "token":
			token := extractToken(c)
			if token == "" {
				c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "bearer token required"})
				c.Abort()
				return
			}
			if err := validateK8sToken(c.Request.Context(), mgr, token); err != nil {
				c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "invalid kubernetes token"})
				c.Abort()
				return
			}
			c.Set(TokenKey, token)
			c.Set(InternalUserRoleKey, string(auth.RoleAdmin)) // K8s token = admin-level
			c.Next()

		case "oidc":
			if verifier == nil {
				c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "OIDC not configured"})
				c.Abort()
				return
			}
			token := extractToken(c)
			if token == "" {
				c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "OIDC token required"})
				c.Abort()
				return
			}
			idToken, err := verifier.Verify(c.Request.Context(), token)
			if err != nil {
				c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "invalid OIDC token"})
				c.Abort()
				return
			}
			var claims struct {
				Email string `json:"email"`
				Name  string `json:"name"`
			}
			_ = idToken.Claims(&claims)
			c.Set(UserKey, claims.Email)
			c.Set(InternalUserRoleKey, string(auth.RoleAdmin))
			c.Next()

		default:
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "unknown auth mode: " + cfg.Mode})
			c.Abort()
		}
	}
}

func extractToken(c *gin.Context) string {
	bearer := c.GetHeader("Authorization")
	if strings.HasPrefix(bearer, "Bearer ") {
		return strings.TrimPrefix(bearer, "Bearer ")
	}
	if t, err := c.Cookie("kd_token"); err == nil && t != "" {
		return t
	}
	return c.Query("token")
}

func validateK8sToken(ctx context.Context, mgr *k8s.Manager, token string) error {
	client, err := mgr.Current()
	if err != nil {
		return err
	}
	tr := &authv1.TokenReview{Spec: authv1.TokenReviewSpec{Token: token}}
	result, err := client.Clientset.AuthenticationV1().TokenReviews().Create(ctx, tr, metav1.CreateOptions{})
	if err != nil {
		return err
	}
	if !result.Status.Authenticated {
		return http.ErrNoCookie
	}
	return nil
}
