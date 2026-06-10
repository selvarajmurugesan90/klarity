package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/gin-gonic/gin"
	"github.com/selvarajmurugesan90/klarity/internal/api"
	"github.com/selvarajmurugesan90/klarity/internal/assets"
	"github.com/selvarajmurugesan90/klarity/internal/auth"
	"github.com/selvarajmurugesan90/klarity/internal/config"
	"github.com/selvarajmurugesan90/klarity/internal/k8s"
)

var (
	version   = "dev"
	gitCommit = "unknown"
	buildDate = "unknown"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		panic("failed to load config: " + err.Error())
	}
	log := config.SetupLogger(cfg.Log)
	log.Infof("Starting Klarity version=%s commit=%s built=%s", version, gitCommit, buildDate)
	log.Infof("Auth mode: %s", cfg.Auth.Mode)

	// ── Kubernetes client ──────────────────────────────────────────────────
	mgr := k8s.NewManager(log)
	kubeconfigPath := os.Getenv("KUBECONFIG")
	if err := mgr.Auto(kubeconfigPath); err != nil {
		log.Fatalf("Failed to connect to Kubernetes: %v", err)
	}

	// ── Internal user store (used when authMode=internal) ──────────────────
	var userStore *auth.UserStore
	var jwtMgr *auth.JWTManager

	client, err := mgr.Current()
	if err == nil {
		userStore = auth.NewUserStore(client.Clientset)
		if loadErr := userStore.Load(context.Background()); loadErr != nil {
			log.Warnf("User store load failed (may need RBAC permissions): %v", loadErr)
			// Still create the store — it will use in-memory defaults
		} else {
			log.Info("User store loaded from Kubernetes Secret")
		}

		jwtMgr, err = auth.NewJWTManager(client.Clientset)
		if err != nil {
			log.Warnf("JWT manager init failed: %v", err)
		} else {
			log.Info("JWT manager initialized")
		}
	}

	// ── Router ─────────────────────────────────────────────────────────────
	router := api.NewRouter(cfg, mgr, log, userStore, jwtMgr)

	// ── Serve embedded React frontend ──────────────────────────────────────
	distFS, err := assets.FS()
	if err == nil {
		fileServer := http.FileServer(http.FS(distFS))
		router.NoRoute(func(c *gin.Context) {
			if len(c.Request.URL.Path) >= 4 && c.Request.URL.Path[:4] == "/api" {
				c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "not found"})
				return
			}
			if _, statErr := http.FS(distFS).Open(c.Request.URL.Path); statErr != nil {
				c.FileFromFS("index.html", http.FS(distFS))
				return
			}
			fileServer.ServeHTTP(c.Writer, c.Request)
		})
	} else {
		log.Warn("Frontend assets not embedded — API-only mode")
	}

	srv := &http.Server{
		Addr:         ":" + cfg.Server.Port,
		Handler:      router,
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
	}

	go func() {
		log.Infof("Server listening on :%s (auth=%s)", cfg.Server.Port, cfg.Auth.Mode)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info("Shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), cfg.Server.ShutdownTimeout)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Errorf("Forced shutdown: %v", err)
	}
	log.Info("Server stopped")
}
