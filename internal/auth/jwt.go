package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

const (
	jwtSecretName = "klarity-jwt-secret"
	jwtSecretKey  = "secret"
	AccessTTL     = 8 * time.Hour
	RefreshTTL    = 7 * 24 * time.Hour
)

// Claims is the JWT payload for a dashboard session
type Claims struct {
	UserID      string `json:"uid"`
	Username    string `json:"username"`
	DisplayName string `json:"displayName"`
	Role        string `json:"role"`
	TokenType   string `json:"type"` // "access" | "refresh"
	jwt.RegisteredClaims
}

// JWTManager handles token signing and validation
type JWTManager struct {
	secret []byte
	// In-memory blocklist for invalidated tokens (logged-out JWTs)
	// Key: jti, Value: expiry time
	blocklist map[string]time.Time
}

func NewJWTManager(cs kubernetes.Interface) (*JWTManager, error) {
	secret, err := loadOrCreateJWTSecret(context.Background(), cs)
	if err != nil {
		return nil, fmt.Errorf("jwt secret: %w", err)
	}
	return &JWTManager{secret: secret, blocklist: make(map[string]time.Time)}, nil
}

func loadOrCreateJWTSecret(ctx context.Context, cs kubernetes.Interface) ([]byte, error) {
	secret, err := cs.CoreV1().Secrets(secretNamespace).Get(ctx, jwtSecretName, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		// Generate a cryptographically random 64-byte secret
		raw := make([]byte, 64)
		if _, err := rand.Read(raw); err != nil {
			return nil, err
		}
		encoded := base64.StdEncoding.EncodeToString(raw)
		newSecret := &corev1.Secret{
			ObjectMeta: metav1.ObjectMeta{
				Name:      jwtSecretName,
				Namespace: secretNamespace,
				Labels:    map[string]string{"app.kubernetes.io/managed-by": "klarity"},
			},
			Data: map[string][]byte{jwtSecretKey: []byte(encoded)},
		}
		created, err := cs.CoreV1().Secrets(secretNamespace).Create(ctx, newSecret, metav1.CreateOptions{})
		if err != nil {
			return nil, err
		}
		return created.Data[jwtSecretKey], nil
	}
	if err != nil {
		return nil, err
	}
	return secret.Data[jwtSecretKey], nil
}

// Issue generates an access + refresh token pair for a user
func (m *JWTManager) Issue(user *User) (accessToken, refreshToken string, err error) {
	accessToken, err = m.sign(user, "access", AccessTTL)
	if err != nil {
		return
	}
	refreshToken, err = m.sign(user, "refresh", RefreshTTL)
	return
}

func (m *JWTManager) sign(user *User, tokenType string, ttl time.Duration) (string, error) {
	now := time.Now().UTC()
	jti := fmt.Sprintf("%x-%x", now.UnixNano(), len(user.ID))
	claims := Claims{
		UserID:      user.ID,
		Username:    user.Username,
		DisplayName: user.DisplayName,
		Role:        string(user.Role),
		TokenType:   tokenType,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        jti,
			Subject:   user.Username,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
			Issuer:    "klarity",
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.secret)
}

// Validate parses and validates a token, returning its claims
func (m *JWTManager) Validate(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return m.secret, nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token claims")
	}

	// Check blocklist
	if _, blocked := m.blocklist[claims.ID]; blocked {
		return nil, errors.New("token has been revoked")
	}

	return claims, nil
}

// Refresh validates a refresh token and issues a new access token
func (m *JWTManager) Refresh(refreshTokenStr string, store *UserStore) (accessToken string, err error) {
	claims, err := m.Validate(refreshTokenStr)
	if err != nil {
		return "", err
	}
	if claims.TokenType != "refresh" {
		return "", errors.New("not a refresh token")
	}
	user, err := store.GetByID(claims.UserID)
	if err != nil {
		return "", err
	}
	if !user.Active {
		return "", ErrAccountDisabled
	}
	return m.sign(user, "access", AccessTTL)
}

// Revoke adds a token to the blocklist (logout)
func (m *JWTManager) Revoke(tokenStr string) {
	claims, err := m.Validate(tokenStr)
	if err != nil {
		return
	}
	if claims.ExpiresAt != nil {
		m.blocklist[claims.ID] = claims.ExpiresAt.Time
	}
	m.pruneBlocklist()
}

func (m *JWTManager) pruneBlocklist() {
	now := time.Now()
	for jti, exp := range m.blocklist {
		if now.After(exp) {
			delete(m.blocklist, jti)
		}
	}
}
