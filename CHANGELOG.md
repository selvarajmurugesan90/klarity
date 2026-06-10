# Changelog

All notable changes to this project are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.0] — 2024

### Added

#### Core
- Complete Kubernetes resource visibility: 60+ resource types across 15+ API groups
- Automatic API discovery via Kubernetes discovery API — no configuration needed
- In-cluster auto-configuration (ServiceAccount token, zero setup)
- Multi-cluster support via kubeconfig Secret

#### Authentication & User Management
- Internal user management (username/password, bcrypt, JWT)
- Three roles: admin, editor, viewer
- Account lockout after 5 failed attempts (15 min)
- Force password change on first login
- Kubernetes ServiceAccount token authentication
- OIDC / SSO support

#### Observability
- Real-time log streaming (WebSocket) with severity filter (ERROR/WARN/INFO/DEBUG)
- Web terminal — `kubectl exec` via xterm.js
- Port forwarding — HTTP proxy tunnel through dashboard
- Activities panel — persistent sidebar for pinned log/terminal sessions
- Network topology graph (Ingress → Service → Deployment → Pod)
- CPU/Memory metrics via metrics-server
- Global search across all resource types (Ctrl+K)
- Cluster health HTML report (downloadable)
- Audit log (ring buffer, 2000 events)
- Real-time events with severity filter

#### GitOps Integration
- Auto-detect ArgoCD (by CRD presence — zero config)
- Auto-detect Flux CD (by CRD presence — zero config)
- ArgoCD: applications, sync status, health, source, revision
- Flux CD: Kustomizations, HelmReleases, GitRepositories, HelmRepositories, alerts

#### Infrastructure
- Helm chart with full production configuration
- YAML manifests + Kustomize
- Docker multi-stage build (final image: ~15MB)
- Non-root container, read-only root filesystem, all capabilities dropped
- GitHub Actions CI/CD pipeline

#### Philosophy
- Read-only dashboard — no create/edit/delete for configuration resources
- GitOps-first — mutations belong in Git, not in a dashboard UI
- Emergency ops retained: restart deployment, cordon/drain node, trigger CronJob
