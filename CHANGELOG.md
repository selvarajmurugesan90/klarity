# Changelog

All notable changes to this project are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.1] — 2026-06-13

### Fixed
- Remove duplicated `/api/v1` prefix in frontend API calls — Sidebar, ArgoCD, FluxCD, GitOps Dashboard, Port Forwarding pages were double-prefixing routes since the axios client already sets `baseURL: /api/v1` (contributed by @Raznak, closes #2)
- Resolve all 66 ESLint `@typescript-eslint/no-unused-vars` errors across 29 frontend files (contributed by @Raznak, closes #4)
- Fix `react-hooks/exhaustive-deps` warnings in `useKeyboardShortcuts`, `Login`, and `Events` — wrap constant maps in `useMemo`, add proper `useEffect` dependencies
- Remove unused `_yamlData` destructuring in `CronJobDetail`, `DaemonSetDetail`, `StatefulSetDetail` — YAML tab renders from the primary query via `JSON.stringify`
- Fix Helm `release.yml` workflow to only update `appVersion` on release tag — `version` (chart structure) is now independent of Docker image releases
- Remove broken ArtifactHub badge from README — package not yet registered at artifacthub.io

### Added
- Make AWS config path configurable via `AWSCONFIG` env var in `docker-compose.yaml` for EKS local dev; add `AWS_CLI_CACHE_DIR` and `AWS_CLI_HISTORY_FILE` to avoid container permission issues (contributed by @chrisjiayoulin, closes #1)

### CI
- Fix ESLint 9 flat config: replace `.eslintrc` with `web/eslint.config.js`, remove unsupported `--ext` flag
- Fix CI build order: frontend must be built and copied to `internal/assets/web/dist` before Go lint/test (required by `//go:embed`)
- Use `npm install` instead of `npm ci` (no `package-lock.json` in repository)
- Add `--timeout=5m` to golangci-lint to prevent 60s default timeout
- Add `--passWithNoTests` to vitest for projects without test files
- Use `GONOSUMDB=* GOFLAGS=-mod=mod` in Docker `go build` for reliable offline-friendly builds

---

## [1.0.0] — 2026-06-10

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
