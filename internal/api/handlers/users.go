package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/selvarajmurugesan90/klarity/internal/auth"
)

// UserHandler wraps the user store and JWT manager
type UserHandler struct {
	Store *auth.UserStore
	JWT   *auth.JWTManager
}

// ── Auth endpoints ─────────────────────────────────────────────────────────

// InternalLogin handles username/password login for the internal auth mode
func (u *UserHandler) InternalLogin(c *gin.Context) {
	var body struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "username and password are required"})
		return
	}

	user, err := u.Store.Authenticate(c.Request.Context(), body.Username, body.Password)
	if err != nil {
		switch err {
		case auth.ErrAccountLocked:
			c.JSON(http.StatusTooManyRequests, gin.H{"success": false, "error": err.Error()})
		case auth.ErrAccountDisabled:
			c.JSON(http.StatusForbidden, gin.H{"success": false, "error": err.Error()})
		default:
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "invalid username or password"})
		}
		return
	}

	accessToken, refreshToken, err := u.JWT.Issue(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "failed to issue token"})
		return
	}

	// Store refresh token in httpOnly cookie
	c.SetCookie("kd_refresh", refreshToken, int(auth.RefreshTTL.Seconds()), "/", "", false, true)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"accessToken":  accessToken,
			"user":         user.Safe(),
			"mustChangePw": user.MustChangePw,
			"expiresIn":    int(auth.AccessTTL.Seconds()),
		},
	})
}

// RefreshToken issues a new access token from a refresh token
func (u *UserHandler) RefreshToken(c *gin.Context) {
	refreshToken, err := c.Cookie("kd_refresh")
	if err != nil || refreshToken == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "no refresh token"})
		return
	}

	accessToken, err := u.JWT.Refresh(refreshToken, u.Store)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"accessToken": accessToken}})
}

// InternalLogout revokes tokens and clears cookies
func (u *UserHandler) InternalLogout(c *gin.Context) {
	// Revoke access token
	if bearer := c.GetHeader("Authorization"); len(bearer) > 7 {
		u.JWT.Revoke(bearer[7:])
	}
	// Revoke refresh token
	if rt, err := c.Cookie("kd_refresh"); err == nil {
		u.JWT.Revoke(rt)
	}
	c.SetCookie("kd_refresh", "", -1, "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"loggedOut": true}})
}

// GetMe returns the currently authenticated user's profile
func (u *UserHandler) GetMe(c *gin.Context) {
	userID := c.GetString("internal_user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "not authenticated"})
		return
	}
	user, err := u.Store.GetByID(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": user.Safe()})
}

// ── User CRUD (admin only) ──────────────────────────────────────────────────

func (u *UserHandler) ListUsers(c *gin.Context) {
	users := u.Store.List()
	c.JSON(http.StatusOK, gin.H{"success": true, "data": users, "total": len(users)})
}

func (u *UserHandler) CreateUser(c *gin.Context) {
	var req auth.CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}
	if req.Username == "" || req.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "username and password are required"})
		return
	}
	if req.Role == "" {
		req.Role = auth.RoleViewer
	}

	user, err := u.Store.Create(c.Request.Context(), req)
	if err != nil {
		status := http.StatusInternalServerError
		if err == auth.ErrUserExists {
			status = http.StatusConflict
		} else if err.Error() == "password must be at least 8 characters" {
			status = http.StatusBadRequest
		}
		c.JSON(status, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": user})
}

func (u *UserHandler) GetUser(c *gin.Context) {
	id := c.Param("id")
	user, err := u.Store.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": user.Safe()})
}

func (u *UserHandler) UpdateUser(c *gin.Context) {
	id := c.Param("id")
	var req auth.UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}
	user, err := u.Store.Update(c.Request.Context(), id, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": user})
}

func (u *UserHandler) DeleteUser(c *gin.Context) {
	// Prevent self-deletion
	if c.Param("id") == c.GetString("internal_user_id") {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "cannot delete your own account"})
		return
	}
	if err := u.Store.Delete(c.Request.Context(), c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"deleted": c.Param("id")}})
}

func (u *UserHandler) ChangePassword(c *gin.Context) {
	id := c.Param("id")
	requesterID := c.GetString("internal_user_id")
	requesterRole := c.GetString("internal_user_role")

	var body struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	// Admin can reset any password without knowing current
	currentPw := body.CurrentPassword
	if requesterRole == string(auth.RoleAdmin) && id != requesterID {
		currentPw = "" // admin bypass
	}

	if err := u.Store.ChangePassword(c.Request.Context(), id, currentPw, body.NewPassword); err != nil {
		status := http.StatusBadRequest
		if err == auth.ErrInvalidCredentials {
			status = http.StatusUnauthorized
		}
		c.JSON(status, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"passwordChanged": true}})
}

func (u *UserHandler) UnlockUser(c *gin.Context) {
	if err := u.Store.UnlockUser(c.Request.Context(), c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"unlocked": true}})
}

// ResetPassword — admin generates a temporary password for a user
func (u *UserHandler) ResetPassword(c *gin.Context) {
	id := c.Param("id")
	var body struct {
		NewPassword string `json:"newPassword"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.NewPassword == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "newPassword required"})
		return
	}
	if err := u.Store.ChangePassword(c.Request.Context(), id, "", body.NewPassword); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}
	// Force user to change password on next login
	active := true
	mustChange := true
	_, _ = u.Store.Update(c.Request.Context(), id, auth.UpdateUserRequest{Active: &active, MustChangePw: &mustChange})
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"passwordReset": true, "mustChangePassword": true}})
}
