// Package auth implements the internal user management system.
// Users are stored in a Kubernetes Secret so they persist across pod restarts.
// Passwords are hashed with bcrypt (cost 12). Tokens are signed JWTs.
package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// Role defines what a user can do
type Role string

const (
	RoleAdmin    Role = "admin"   // Full read/write access to everything
	RoleEditor   Role = "editor"  // Read + create/update workloads. No delete of RBAC/cluster resources
	RoleViewer   Role = "viewer"  // Read-only access to all resources
)

// User is a dashboard user
type User struct {
	ID           string    `json:"id"`
	Username     string    `json:"username"`
	DisplayName  string    `json:"displayName"`
	Email        string    `json:"email,omitempty"`
	PasswordHash string    `json:"passwordHash"`
	Role         Role      `json:"role"`
	Active       bool      `json:"active"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
	LastLoginAt  *time.Time `json:"lastLoginAt,omitempty"`
	MustChangePw bool      `json:"mustChangePassword"`
	// Login attempt tracking
	FailedAttempts int        `json:"failedAttempts"`
	LockedUntil    *time.Time `json:"lockedUntil,omitempty"`
}

// SafeUser is the User struct with password hash removed — safe to return to clients
type SafeUser struct {
	ID           string     `json:"id"`
	Username     string     `json:"username"`
	DisplayName  string     `json:"displayName"`
	Email        string     `json:"email,omitempty"`
	Role         Role       `json:"role"`
	Active       bool       `json:"active"`
	CreatedAt    time.Time  `json:"createdAt"`
	UpdatedAt    time.Time  `json:"updatedAt"`
	LastLoginAt  *time.Time `json:"lastLoginAt,omitempty"`
	MustChangePw bool       `json:"mustChangePassword"`
	Locked       bool       `json:"locked"`
}

func (u *User) Safe() SafeUser {
	locked := u.LockedUntil != nil && time.Now().Before(*u.LockedUntil)
	return SafeUser{
		ID: u.ID, Username: u.Username, DisplayName: u.DisplayName,
		Email: u.Email, Role: u.Role, Active: u.Active,
		CreatedAt: u.CreatedAt, UpdatedAt: u.UpdatedAt,
		LastLoginAt: u.LastLoginAt, MustChangePw: u.MustChangePw,
		Locked: locked,
	}
}

const (
	secretName      = "klarity-users"
	secretNamespace = "klarity"
	secretKey       = "users.json"
	maxFailedLogins = 5
	lockoutDuration = 15 * time.Minute
	bcryptCost      = 12
)

// UserStore manages dashboard users, persisted in a Kubernetes Secret
type UserStore struct {
	mu        sync.RWMutex
	users     map[string]*User // keyed by username (lowercase)
	clientset kubernetes.Interface
}

func NewUserStore(cs kubernetes.Interface) *UserStore {
	return &UserStore{
		users:     make(map[string]*User),
		clientset: cs,
	}
}

// Load reads users from the Kubernetes Secret
func (s *UserStore) Load(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	secret, err := s.clientset.CoreV1().Secrets(secretNamespace).Get(ctx, secretName, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		// First run — create default admin
		return s.createDefaults(ctx)
	}
	if err != nil {
		return fmt.Errorf("load users secret: %w", err)
	}

	data, ok := secret.Data[secretKey]
	if !ok || len(data) == 0 {
		return s.createDefaults(ctx)
	}

	var users []*User
	if err := json.Unmarshal(data, &users); err != nil {
		return fmt.Errorf("parse users: %w", err)
	}

	s.users = make(map[string]*User, len(users))
	for _, u := range users {
		s.users[u.Username] = u
	}
	return nil
}

// createDefaults sets up the initial admin account. Must be called with lock held.
func (s *UserStore) createDefaults(ctx context.Context) error {
	hash, err := bcrypt.GenerateFromPassword([]byte("admin@123"), bcryptCost)
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	admin := &User{
		ID: generateID(), Username: "admin", DisplayName: "Administrator",
		Email: "admin@klarity.local",
		PasswordHash: string(hash), Role: RoleAdmin,
		Active: true, MustChangePw: true,
		CreatedAt: now, UpdatedAt: now,
	}

	// Read-only viewer account
	viewerHash, _ := bcrypt.GenerateFromPassword([]byte("viewer@123"), bcryptCost)
	viewer := &User{
		ID: generateID(), Username: "viewer", DisplayName: "Read-Only Viewer",
		PasswordHash: string(viewerHash), Role: RoleViewer,
		Active: true, MustChangePw: false,
		CreatedAt: now, UpdatedAt: now,
	}

	s.users = map[string]*User{"admin": admin, "viewer": viewer}
	return s.flush(ctx)
}

// flush writes the current users map to the Kubernetes Secret (lock must be held)
func (s *UserStore) flush(ctx context.Context) error {
	users := make([]*User, 0, len(s.users))
	for _, u := range s.users {
		users = append(users, u)
	}
	data, err := json.Marshal(users)
	if err != nil {
		return err
	}

	secret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      secretName,
			Namespace: secretNamespace,
			Labels:    map[string]string{"app.kubernetes.io/managed-by": "klarity"},
		},
		Data: map[string][]byte{secretKey: data},
	}

	_, err = s.clientset.CoreV1().Secrets(secretNamespace).Get(ctx, secretName, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		_, err = s.clientset.CoreV1().Secrets(secretNamespace).Create(ctx, secret, metav1.CreateOptions{})
	} else if err == nil {
		_, err = s.clientset.CoreV1().Secrets(secretNamespace).Update(ctx, secret, metav1.UpdateOptions{})
	}
	return err
}

// ──  Public API ──────────────────────────────────────────────────────────────

var ErrInvalidCredentials = errors.New("invalid username or password")
var ErrAccountLocked = errors.New("account is temporarily locked due to too many failed attempts")
var ErrAccountDisabled = errors.New("account is disabled")
var ErrUserNotFound = errors.New("user not found")
var ErrUserExists = errors.New("username already exists")

// Authenticate validates credentials and returns the user on success
func (s *UserStore) Authenticate(ctx context.Context, username, password string) (*User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	u, ok := s.users[username]
	if !ok {
		// Constant-time rejection to prevent username enumeration
		_ = bcrypt.CompareHashAndPassword([]byte("$2a$12$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"), []byte(password))
		return nil, ErrInvalidCredentials
	}

	if !u.Active {
		return nil, ErrAccountDisabled
	}

	// Check lockout
	if u.LockedUntil != nil && time.Now().Before(*u.LockedUntil) {
		return nil, ErrAccountLocked
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)); err != nil {
		u.FailedAttempts++
		if u.FailedAttempts >= maxFailedLogins {
			lockUntil := time.Now().Add(lockoutDuration)
			u.LockedUntil = &lockUntil
		}
		u.UpdatedAt = time.Now().UTC()
		_ = s.flush(ctx)
		return nil, ErrInvalidCredentials
	}

	// Reset failure count on successful login
	u.FailedAttempts = 0
	u.LockedUntil = nil
	now := time.Now().UTC()
	u.LastLoginAt = &now
	u.UpdatedAt = now
	_ = s.flush(ctx)
	return u, nil
}

func (s *UserStore) GetByID(id string) (*User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, u := range s.users {
		if u.ID == id {
			return u, nil
		}
	}
	return nil, ErrUserNotFound
}

func (s *UserStore) GetByUsername(username string) (*User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	u, ok := s.users[username]
	if !ok {
		return nil, ErrUserNotFound
	}
	return u, nil
}

func (s *UserStore) List() []SafeUser {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]SafeUser, 0, len(s.users))
	for _, u := range s.users {
		result = append(result, u.Safe())
	}
	return result
}

type CreateUserRequest struct {
	Username    string `json:"username"`
	DisplayName string `json:"displayName"`
	Email       string `json:"email"`
	Password    string `json:"password"`
	Role        Role   `json:"role"`
}

func (s *UserStore) Create(ctx context.Context, req CreateUserRequest) (*SafeUser, error) {
	if err := validatePassword(req.Password); err != nil {
		return nil, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.users[req.Username]; exists {
		return nil, ErrUserExists
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcryptCost)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	u := &User{
		ID: generateID(), Username: req.Username,
		DisplayName: req.DisplayName, Email: req.Email,
		PasswordHash: string(hash), Role: req.Role,
		Active: true, MustChangePw: false,
		CreatedAt: now, UpdatedAt: now,
	}
	s.users[req.Username] = u
	if err := s.flush(ctx); err != nil {
		return nil, err
	}
	safe := u.Safe()
	return &safe, nil
}

type UpdateUserRequest struct {
	DisplayName  *string `json:"displayName,omitempty"`
	Email        *string `json:"email,omitempty"`
	Role         *Role   `json:"role,omitempty"`
	Active       *bool   `json:"active,omitempty"`
	MustChangePw *bool   `json:"mustChangePassword,omitempty"`
}

func (s *UserStore) Update(ctx context.Context, id string, req UpdateUserRequest) (*SafeUser, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var u *User
	for _, user := range s.users {
		if user.ID == id {
			u = user
			break
		}
	}
	if u == nil {
		return nil, ErrUserNotFound
	}

	if req.DisplayName != nil { u.DisplayName = *req.DisplayName }
	if req.Email != nil { u.Email = *req.Email }
	if req.Role != nil { u.Role = *req.Role }
	if req.Active != nil { u.Active = *req.Active }
	if req.MustChangePw != nil { u.MustChangePw = *req.MustChangePw }
	u.UpdatedAt = time.Now().UTC()

	if err := s.flush(ctx); err != nil {
		return nil, err
	}
	safe := u.Safe()
	return &safe, nil
}

func (s *UserStore) ChangePassword(ctx context.Context, id, currentPw, newPw string) error {
	if err := validatePassword(newPw); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	var u *User
	for _, user := range s.users {
		if user.ID == id {
			u = user
			break
		}
	}
	if u == nil {
		return ErrUserNotFound
	}

	// If currentPw is empty and caller is admin, skip current pw check
	if currentPw != "" {
		if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(currentPw)); err != nil {
			return ErrInvalidCredentials
		}
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPw), bcryptCost)
	if err != nil {
		return err
	}
	u.PasswordHash = string(hash)
	u.MustChangePw = false
	u.UpdatedAt = time.Now().UTC()
	return s.flush(ctx)
}

func (s *UserStore) Delete(ctx context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for username, u := range s.users {
		if u.ID == id {
			// Prevent deleting the last admin
			if u.Role == RoleAdmin {
				adminCount := 0
				for _, user := range s.users {
					if user.Role == RoleAdmin && user.Active {
						adminCount++
					}
				}
				if adminCount <= 1 {
					return errors.New("cannot delete the last active admin account")
				}
			}
			delete(s.users, username)
			return s.flush(ctx)
		}
	}
	return ErrUserNotFound
}

func (s *UserStore) UnlockUser(ctx context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, u := range s.users {
		if u.ID == id {
			u.LockedUntil = nil
			u.FailedAttempts = 0
			u.UpdatedAt = time.Now().UTC()
			return s.flush(ctx)
		}
	}
	return ErrUserNotFound
}

func validatePassword(pw string) error {
	if len(pw) < 8 {
		return errors.New("password must be at least 8 characters")
	}
	if len(pw) > 128 {
		return errors.New("password must not exceed 128 characters")
	}
	return nil
}

// generateID creates a short unique ID
func generateID() string {
	return fmt.Sprintf("%x", time.Now().UnixNano())
}

// RoleAllows checks if a role is permitted to perform an HTTP method
func RoleAllows(role Role, method string) bool {
	switch role {
	case RoleAdmin:
		return true
	case RoleEditor:
		// Can do everything except touching RBAC cluster resources
		return true // detailed path-based restrictions handled in middleware
	case RoleViewer:
		return method == "GET" || method == "OPTIONS" || method == "HEAD"
	}
	return false
}
