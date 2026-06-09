package api

import (
	"net/http"

	"github.com/gin-contrib/cors"
	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"github.com/selvarajmurugesan90/klarity/internal/api/handlers"
	"github.com/selvarajmurugesan90/klarity/internal/api/middleware"
	"github.com/selvarajmurugesan90/klarity/internal/auth"
	"github.com/selvarajmurugesan90/klarity/internal/config"
	"github.com/selvarajmurugesan90/klarity/internal/k8s"
)

func NewRouter(
	cfg *config.Config,
	mgr *k8s.Manager,
	log *logrus.Logger,
	userStore *auth.UserStore,
	jwtMgr *auth.JWTManager,
) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()

	r.Use(gin.Recovery())
	r.Use(middleware.Logger(log))
	r.Use(gzip.Gzip(gzip.DefaultCompression))
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	h := handlers.New(mgr, log, cfg.Auth.Mode)
	r.Use(handlers.AuditMiddleware(mgr.CurrentName))

	var uh *handlers.UserHandler
	if userStore != nil && jwtMgr != nil {
		uh = &handlers.UserHandler{Store: userStore, JWT: jwtMgr}
	}

	// ── Health ────────────────────────────────────────────────────────────────
	r.GET("/healthz", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })
	r.GET("/readyz", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })

	// ── WebSocket ─────────────────────────────────────────────────────────────
	ws := r.Group("/ws")
	{
		ws.GET("/logs/:namespace/:pod", h.WSLogs)
		ws.GET("/exec/:namespace/:pod/:container", h.WSExec)
		ws.GET("/events", h.WSEvents)
		ws.GET("/metrics", h.WSMetrics)
	}

	// ── Public endpoints (no auth required) ──────────────────────────────────
	pub := r.Group("/api/v1")
	{
		// Auth config — always public so the login page knows which flow to use
		pub.GET("/auth/config", h.GetAuthConfig)

		// Internal auth login/refresh/logout — public endpoints
		if uh != nil {
			pub.POST("/auth/internal/login", uh.InternalLogin)
			pub.POST("/auth/internal/refresh", uh.RefreshToken)
			pub.POST("/auth/internal/logout", uh.InternalLogout)
		}
	}

	// ── Protected API v1 ─────────────────────────────────────────────────────
	api := r.Group("/api/v1")
	api.Use(middleware.Auth(cfg.Auth, mgr, log, userStore, jwtMgr))
	{
		// ── Auth (token / OIDC login — kept for backward compat) ──────────────
		api.GET("/auth/check", h.CheckAuth)
		api.POST("/auth/login", h.Login)
		api.POST("/auth/logout", h.Logout)

		// ── Current user profile ──────────────────────────────────────────────
		if uh != nil {
			api.GET("/auth/me", uh.GetMe)
			api.PUT("/auth/me/password", func(c *gin.Context) {
				c.Params = append(c.Params, gin.Param{Key: "id", Value: c.GetString("internal_user_id")})
				uh.ChangePassword(c)
			})

			// ── User management (admin only, enforced in middleware) ───────────
			api.GET("/users", uh.ListUsers)
			api.POST("/users", uh.CreateUser)
			api.GET("/users/:id", uh.GetUser)
			api.PUT("/users/:id", uh.UpdateUser)
			api.DELETE("/users/:id", uh.DeleteUser)
			api.PUT("/users/:id/password", uh.ChangePassword)
			api.PUT("/users/:id/reset-password", uh.ResetPassword)
			api.POST("/users/:id/unlock", uh.UnlockUser)
		}

		// ── Port Forwarding ──────────────────────────────────────────────────
		api.GET("/portforward", h.ListPortForwards)
		api.POST("/portforward", h.CreatePortForward)
		api.POST("/portforward/service", h.CreateServicePortForward)
		api.DELETE("/portforward/:id", h.DeletePortForward)
		api.Any("/portforward/proxy/:id/*path", h.ProxyPortForward)

		// ── GitOps (ArgoCD + Flux CD auto-detection) ──────────────────────────
		api.GET("/gitops/status", h.GetGitOpsStatus)
		api.GET("/gitops/argocd/apps", h.ListArgoApps)
		api.GET("/gitops/argocd/apps/:name", h.GetArgoApp)
		api.GET("/gitops/argocd/appsets", h.ListArgoAppSets)
		api.GET("/gitops/argocd/projects", h.ListArgoProjects)
		api.GET("/gitops/flux/gitrepositories", h.ListFluxGitRepos)
		api.GET("/gitops/flux/helmrepositories", h.ListFluxHelmRepos)
		api.GET("/gitops/flux/ocirepositories", h.ListFluxOCIRepos)
		api.GET("/gitops/flux/kustomizations", h.ListFluxKustomizations)
		api.GET("/gitops/flux/helmreleases", h.ListFluxHelmReleases)
		api.GET("/gitops/flux/helmcharts", h.ListFluxHelmCharts)
		api.GET("/gitops/flux/alerts", h.ListFluxAlerts)
		api.GET("/gitops/flux/receivers", h.ListFluxReceivers)
		api.GET("/gitops/flux/buckets", h.ListFluxBuckets)
		api.GET("/gitops/flux/:resource/:namespace/:name", h.GetFluxResource)

		// ── Cluster info ──────────────────────────────────────────────────────
		api.GET("/clusters", h.ListClusters)
		api.POST("/clusters/switch", h.SwitchCluster)
		api.GET("/version", h.GetServerVersion)
		api.GET("/overview", h.GetOverview)

		// ── Global search ─────────────────────────────────────────────────────
		api.GET("/search", h.GlobalSearch)

		// ── Audit log ─────────────────────────────────────────────────────────
		api.GET("/audit", h.GetAuditLog)
		api.GET("/audit/stats", h.GetAuditStats)

		// ── Reports ───────────────────────────────────────────────────────────
		api.GET("/reports/health", h.ClusterHealthReport)

		// ── Identity ──────────────────────────────────────────────────────────
		api.GET("/identity/subjects", h.ListIdentities)
		api.GET("/identity/subjects/:kind/:name/permissions", h.GetIdentityPermissions)

		// ── Network topology ──────────────────────────────────────────────────
		api.GET("/topology", h.GetNetworkTopology)
		api.GET("/topology/:namespace", h.GetNetworkTopology)

		// ── API Discovery ─────────────────────────────────────────────────────
		api.GET("/apiresources", h.GetAPIResources)
		api.GET("/apigroups", h.GetAPIGroups)

		// ── Generic dynamic resource (cluster-scoped) ─────────────────────────
		api.GET("/dynamic/:group/:version/:resource", h.ListDynamic)
		api.GET("/dynamic/:group/:version/:resource/:name", h.GetDynamic)
		api.DELETE("/dynamic/:group/:version/:resource/:name", h.DeleteDynamic)
		api.GET("/dynamic/:group/:version/:resource/:name/yaml", h.GetDynamicYAML)

		// ── Generic dynamic resource (namespace-scoped) ───────────────────────
		nsdyn := api.Group("/dynamic/:group/:version/namespaces/:namespace")
		{
			nsdyn.GET("/:resource", h.ListDynamic)
			nsdyn.GET("/:resource/:name", h.GetDynamic)
			nsdyn.DELETE("/:resource/:name", h.DeleteDynamic)
			nsdyn.GET("/:resource/:name/yaml", h.GetDynamicYAML)
		}

		// ── Generic apply / patch / delete ────────────────────────────────────
		api.POST("/apply", h.Apply)
		api.DELETE("/resource", h.Delete)
		api.PATCH("/resource", h.PatchResource)

		// ── Namespaces ────────────────────────────────────────────────────────
		api.GET("/namespaces", h.ListNamespaces)
		api.GET("/namespaces/:namespace", h.GetNamespace)
		api.DELETE("/namespaces/:namespace", h.DeleteNamespace)

		// ── Nodes ─────────────────────────────────────────────────────────────
		api.GET("/nodes", h.ListNodes)
		api.GET("/nodes/:name", h.GetNode)
		api.GET("/nodes/:name/yaml", h.GetNodeYAML)
		api.GET("/nodes/:name/pods", h.GetNodePods)
		api.PATCH("/nodes/:name/cordon", h.CordonNode)
		api.GET("/nodes/:name/metrics", h.GetSingleNodeMetrics)

		// ── Events ────────────────────────────────────────────────────────────
		api.GET("/events", h.ListEvents)
		api.GET("/componentstatuses", h.ListComponentStatuses)

		// ── Metrics ───────────────────────────────────────────────────────────
		api.GET("/metrics/available", h.MetricsAvailable)
		api.GET("/metrics/all-pods", h.GetAllPodMetrics)
		api.GET("/metrics/namespaces", h.GetNamespaceMetricsSummary)
		api.GET("/metrics/nodes", h.GetNodeMetrics)
		api.GET("/metrics/pods", h.GetPodMetrics)

		// ── Cluster-scoped storage ────────────────────────────────────────────
		api.GET("/persistentvolumes", h.ListPersistentVolumes)
		api.GET("/persistentvolumes/:name", h.GetPersistentVolume)
		api.DELETE("/persistentvolumes/:name", h.DeletePersistentVolume)
		api.GET("/persistentvolumes/:name/yaml", h.GetPersistentVolumeYAML)
		api.GET("/storageclasses", h.ListStorageClasses)
		api.GET("/storageclasses/:name", h.GetStorageClass)
		api.GET("/volumeattachments", h.ListVolumeAttachments)
		api.GET("/csidrivers", h.ListCSIDrivers)
		api.GET("/csinodes", h.ListCSINodes)

		// ── Cluster-scoped RBAC ───────────────────────────────────────────────
		api.GET("/clusterroles", h.ListClusterRoles)
		api.GET("/clusterroles/:name", h.GetClusterRole)
		api.DELETE("/clusterroles/:name", h.DeleteClusterRole)
		api.GET("/clusterrolebindings", h.ListClusterRoleBindings)
		api.GET("/clusterrolebindings/:name", h.GetClusterRoleBinding)
		api.DELETE("/clusterrolebindings/:name", h.DeleteClusterRoleBinding)

		// ── Cluster-scoped policy ─────────────────────────────────────────────
		api.GET("/priorityclasses", h.ListPriorityClasses)
		api.GET("/priorityclasses/:name", h.GetPriorityClass)
		api.GET("/runtimeclasses", h.ListRuntimeClasses)
		api.GET("/runtimeclasses/:name", h.GetRuntimeClass)
		api.GET("/mutatingwebhookconfigurations", h.ListMutatingWebhooks)
		api.GET("/mutatingwebhookconfigurations/:name", h.GetMutatingWebhook)
		api.DELETE("/mutatingwebhookconfigurations/:name", h.DeleteMutatingWebhook)
		api.GET("/validatingwebhookconfigurations", h.ListValidatingWebhooks)
		api.GET("/validatingwebhookconfigurations/:name", h.GetValidatingWebhook)
		api.DELETE("/validatingwebhookconfigurations/:name", h.DeleteValidatingWebhook)
		api.GET("/certificatesigningrequests", h.ListCertificateSigningRequests)
		api.GET("/certificatesigningrequests/:name", h.GetCertificateSigningRequest)
		api.GET("/flowschemas", h.ListFlowSchemas)
		api.GET("/flowschemas/:name", h.GetFlowSchema)
		api.GET("/prioritylevelconfigurations", h.ListPriorityLevelConfigurations)
		api.GET("/ingressclasses", h.ListIngressClasses)
		api.GET("/customresourcedefinitions", h.ListCRDs)
		api.GET("/customresourcedefinitions/:name", h.GetCRD)
		api.DELETE("/customresourcedefinitions/:name", h.DeleteCRD)

		// ── All-namespaces list endpoints ─────────────────────────────────────
		api.GET("/pods", h.ListPods)
		api.GET("/deployments", h.ListDeployments)
		api.GET("/statefulsets", h.ListStatefulSets)
		api.GET("/daemonsets", h.ListDaemonSets)
		api.GET("/replicasets", h.ListReplicaSets)
		api.GET("/jobs", h.ListJobs)
		api.GET("/cronjobs", h.ListCronJobs)
		api.GET("/services", h.ListServices)
		api.GET("/ingresses", h.ListIngresses)
		api.GET("/networkpolicies", h.ListNetworkPolicies)
		api.GET("/persistentvolumeclaims", h.ListPersistentVolumeClaims)
		api.GET("/configmaps", h.ListConfigMaps)
		api.GET("/secrets", h.ListSecrets)
		api.GET("/serviceaccounts", h.ListServiceAccounts)
		api.GET("/roles", h.ListRoles)
		api.GET("/rolebindings", h.ListRoleBindings)
		api.GET("/horizontalpodautoscalers", h.ListHPAs)
		api.GET("/poddisruptionbudgets", h.ListPodDisruptionBudgets)
		api.GET("/leases", h.ListLeases)
		api.GET("/replicationcontrollers", h.ListReplicationControllers)

		// ── Namespace-scoped sub-resources ────────────────────────────────────
		ns := api.Group("/namespaces/:namespace")
		{
			ns.GET("/events", h.ListEvents)
			ns.GET("/metrics/pods", h.GetPodMetrics)
			ns.GET("/metrics/pods/:name", h.GetSinglePodMetrics)
			ns.GET("/quota-summary", h.GetQuotaSummary)

			// Pods
			ns.GET("/pods", h.ListPods)
			ns.GET("/pods/:name", h.GetPod)
			ns.DELETE("/pods/:name", h.DeletePod)
			ns.GET("/pods/:name/logs", h.GetPodLogs)
			ns.GET("/pods/:name/yaml", h.GetPodYAML)
			ns.GET("/pods/:name/events", h.GetPodEvents)

			// Deployments
			ns.GET("/deployments", h.ListDeployments)
			ns.GET("/deployments/:name", h.GetDeployment)
			ns.PUT("/deployments/:name", h.UpdateDeployment)
			ns.PUT("/deployments/:name/scale", h.ScaleDeployment)
			ns.POST("/deployments/:name/restart", h.RestartDeployment)
			ns.DELETE("/deployments/:name", h.DeleteDeployment)
			ns.GET("/deployments/:name/yaml", h.GetDeploymentYAML)
			ns.GET("/deployments/:name/events", h.GetDeploymentEvents)
			ns.GET("/deployments/:name/history", h.DeploymentHistory)
			ns.POST("/deployments/:name/rollback", h.RollbackDeployment)

			// StatefulSets
			ns.GET("/statefulsets", h.ListStatefulSets)
			ns.GET("/statefulsets/:name", h.GetStatefulSet)
			ns.PUT("/statefulsets/:name/scale", h.ScaleStatefulSet)
			ns.DELETE("/statefulsets/:name", h.DeleteStatefulSet)
			ns.GET("/statefulsets/:name/yaml", h.GetStatefulSetYAML)

			// DaemonSets
			ns.GET("/daemonsets", h.ListDaemonSets)
			ns.GET("/daemonsets/:name", h.GetDaemonSet)
			ns.DELETE("/daemonsets/:name", h.DeleteDaemonSet)
			ns.GET("/daemonsets/:name/yaml", h.GetDaemonSetYAML)

			// ReplicaSets
			ns.GET("/replicasets", h.ListReplicaSets)
			ns.GET("/replicasets/:name", h.GetReplicaSet)
			ns.DELETE("/replicasets/:name", h.DeleteReplicaSet)
			ns.GET("/controllerrevisions", h.ListControllerRevisions)
			ns.GET("/replicationcontrollers", h.ListReplicationControllers)
			ns.GET("/replicationcontrollers/:name", h.GetReplicationController)

			// Jobs
			ns.GET("/jobs", h.ListJobs)
			ns.GET("/jobs/:name", h.GetJob)
			ns.DELETE("/jobs/:name", h.DeleteJob)
			ns.GET("/jobs/:name/yaml", h.GetJobYAML)

			// CronJobs
			ns.GET("/cronjobs", h.ListCronJobs)
			ns.GET("/cronjobs/:name", h.GetCronJob)
			ns.DELETE("/cronjobs/:name", h.DeleteCronJob)
			ns.POST("/cronjobs/:name/trigger", h.TriggerCronJob)
			ns.PATCH("/cronjobs/:name/suspend", h.SuspendCronJob)

			// Services / Networking
			ns.GET("/services", h.ListServices)
			ns.GET("/services/:name", h.GetService)
			ns.DELETE("/services/:name", h.DeleteService)
			ns.GET("/services/:name/yaml", h.GetServiceYAML)
			ns.GET("/endpoints", h.ListEndpoints)
			ns.GET("/endpointslices", h.ListEndpointSlices)
			ns.GET("/ingresses", h.ListIngresses)
			ns.GET("/ingresses/:name", h.GetIngress)
			ns.DELETE("/ingresses/:name", h.DeleteIngress)
			ns.GET("/ingresses/:name/yaml", h.GetIngressYAML)
			ns.GET("/networkpolicies", h.ListNetworkPolicies)
			ns.GET("/networkpolicies/:name", h.GetNetworkPolicy)
			ns.DELETE("/networkpolicies/:name", h.DeleteNetworkPolicy)

			// Storage
			ns.GET("/persistentvolumeclaims", h.ListPersistentVolumeClaims)
			ns.GET("/persistentvolumeclaims/:name", h.GetPersistentVolumeClaim)
			ns.DELETE("/persistentvolumeclaims/:name", h.DeletePersistentVolumeClaim)

			// Configuration
			ns.GET("/configmaps", h.ListConfigMaps)
			ns.GET("/configmaps/:name", h.GetConfigMap)
			ns.DELETE("/configmaps/:name", h.DeleteConfigMap)
			ns.GET("/configmaps/:name/yaml", h.GetConfigMapYAML)
			ns.GET("/secrets", h.ListSecrets)
			ns.GET("/secrets/:name", h.GetSecret)
			ns.DELETE("/secrets/:name", h.DeleteSecret)
			ns.GET("/secrets/:name/yaml", h.GetSecretYAML)
			ns.GET("/serviceaccounts", h.ListServiceAccounts)
			ns.GET("/serviceaccounts/:name", h.GetServiceAccount)
			ns.DELETE("/serviceaccounts/:name", h.DeleteServiceAccount)
			ns.GET("/resourcequotas", h.ListResourceQuotas)
			ns.GET("/resourcequotas/:name", h.GetResourceQuota)
			ns.GET("/limitranges", h.ListLimitRanges)
			ns.GET("/limitranges/:name", h.GetLimitRange)
			ns.GET("/podtemplates", h.ListPodTemplates)

			// RBAC
			ns.GET("/roles", h.ListRoles)
			ns.GET("/roles/:name", h.GetRole)
			ns.DELETE("/roles/:name", h.DeleteRole)
			ns.GET("/rolebindings", h.ListRoleBindings)
			ns.GET("/rolebindings/:name", h.GetRoleBinding)
			ns.DELETE("/rolebindings/:name", h.DeleteRoleBinding)

			// Autoscaling / Policy
			ns.GET("/horizontalpodautoscalers", h.ListHPAs)
			ns.GET("/horizontalpodautoscalers/:name", h.GetHPA)
			ns.DELETE("/horizontalpodautoscalers/:name", h.DeleteHPA)
			ns.GET("/poddisruptionbudgets", h.ListPodDisruptionBudgets)
			ns.GET("/poddisruptionbudgets/:name", h.GetPodDisruptionBudget)
			ns.DELETE("/poddisruptionbudgets/:name", h.DeletePodDisruptionBudget)
			ns.GET("/leases", h.ListLeases)
		}
	}

	return r
}
