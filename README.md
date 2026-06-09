<div align="center">

<br />

# Klarity

### Enterprise Kubernetes Observability Dashboard

**Read-only by design · GitOps-first · Auto-discovery · Production-ready**

<br />

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg?style=flat-square)](LICENSE)
[![Go Version](https://img.shields.io/badge/Go-1.22+-00ADD8?style=flat-square&logo=go)](https://golang.org)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-1.26+-326CE5?style=flat-square&logo=kubernetes)](https://kubernetes.io)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://reactjs.org)
[![Release](https://img.shields.io/github/v/release/selvarajmurugesan90/klarity?style=flat-square)](https://github.com/selvarajmurugesan90/klarity/releases)

<br />

</div>

---

## What is Klarity?

Klarity is an **open-source enterprise Kubernetes observability dashboard** built for teams that follow GitOps practices.

Most dashboards let you edit resources directly. Klarity deliberately **does not** — because in a proper GitOps workflow your cluster's source of truth lives in Git. Clicking "edit" in a dashboard bypasses your entire review, audit, and pipeline process.

Instead, Klarity gives you **complete visibility** into your cluster — every resource, real-time metrics, live log streaming, web terminal access, port forwarding, and automatic GitOps integration — all without the risk of accidental mutations.

> **"Observe everything. Change nothing."**

---

## Why Klarity?

| Feature | Klarity | Headlamp | k9s |
|---------|:-------:|:--------:|:---:|
| GitOps-First Philosophy | ✅ | ❌ | ❌ |
| Internal User Management | ✅ | ❌ | ❌ |
| Activities Panel (pinned logs/terminals) | ✅ | ✅ | ❌ |
| Auto-Detect ArgoCD + Flux | ✅ Zero config | ❌ | ❌ |
| Web-based (no desktop install) | ✅ | ✅ | ❌ CLI only |
| Audit Log | ✅ | ❌ | ❌ |
| Port Forwarding via Browser | ✅ | ✅ | ❌ |
| 60+ Resource Types Auto-Discovered | ✅ | ✅ | ✅ |
| Single Binary Deployment | ✅ | ❌ | ✅ |

Klarity is built around a single principle most dashboards ignore: **in a GitOps workflow, the dashboard should never be the place where you make changes**. Your cluster's source of truth is Git — not a UI form.

Klarity fills the gap that GitOps creates: you need full visibility into what's running, real-time diagnostics when something goes wrong, and a way to share cluster state with your team — all without the risk of someone accidentally editing a production resource through a web interface.

- **Observe** — every resource type, live metrics, events, topology
- **Diagnose** — log streaming, web terminal, port forwarding
- **Collaborate** — shareable audit log, health reports, user management
- **Integrate** — automatic ArgoCD and Flux CD visibility

---

## Features

### 🔍 Complete Auto-Discovery — 60+ Resource Types

Klarity calls `GET /apis` on startup and maps **every** API group, version, and resource type in your cluster — including all installed CRDs. No configuration. No plugin needed. If your cluster has Istio, ArgoCD, Prometheus Operator, or Cert-Manager installed, all their resources appear automatically.

<details>
<summary><strong>Full resource coverage</strong></summary>

| Category | Resources |
|----------|-----------|
| **Workloads** | Pods · Deployments · StatefulSets · DaemonSets · ReplicaSets · Jobs · CronJobs · ReplicationControllers |
| **Networking** | Services · Ingresses · NetworkPolicies · Endpoints · EndpointSlices · IngressClasses |
| **Storage** | PersistentVolumes · PVClaims · StorageClasses · VolumeAttachments · CSIDrivers · CSINodes |
| **Configuration** | ConfigMaps · Secrets (masked) · ServiceAccounts · ResourceQuotas · LimitRanges |
| **Access Control** | Roles · ClusterRoles · RoleBindings · ClusterRoleBindings |
| **Policy** | HPAs · PodDisruptionBudgets · PriorityClasses · RuntimeClasses |
| **Admission** | MutatingWebhookConfigurations · ValidatingWebhookConfigurations |
| **Certificates** | CertificateSigningRequests |
| **Coordination** | Leases |
| **Flow Control** | FlowSchemas · PriorityLevelConfigurations |
| **Custom Resources** | Every CRD auto-discovered — Istio, ArgoCD, Cert-Manager, etc. |
| **Cluster** | Nodes · Namespaces · Events · ComponentStatuses |

</details>

---

### 🛠 Diagnostic Tools

| Tool | Description |
|------|-------------|
| **Live Log Streaming** | Real-time WebSocket log viewer with severity filter (ERROR / WARN / INFO / DEBUG), keyword search, auto-scroll, and download |
| **Web Terminal** | Full `kubectl exec` experience via xterm.js — no kubectl installation required |
| **Port Forwarding** | HTTP proxy tunnel — access any pod's service port directly in your browser |
| **Activities Panel** | Persistent right-side panel — pin log streams and terminals so they keep running while you navigate |

---

### 🔄 GitOps Integration — Zero Configuration

Klarity automatically detects GitOps tools by scanning the cluster's CRDs. When ArgoCD or Flux CD is installed, the **GitOps** section appears in the sidebar with no setup required.

**ArgoCD**
- All applications with sync status (Synced / OutOfSync) and health (Healthy / Degraded / Progressing)
- Source repository, target path, current revision
- ApplicationSets and AppProjects

**Flux CD**
- Kustomizations with ready status and last reconciled time
- HelmReleases with chart name and version
- GitRepositories, HelmRepositories, OCIRepositories, Buckets
- Notification alerts and receivers

---

### 📊 Observability

- **Real-time metrics** — CPU and Memory utilization via metrics-server with visual progress bars per node
- **Global search** — `Ctrl+K` to instantly search across all resource types concurrently
- **Audit log** — every mutating operation recorded: user, action, resource, namespace, HTTP status
- **Cluster health report** — downloadable self-contained HTML snapshot for compliance or sharing
- **Events** — real-time Kubernetes events with Warning/Normal filter and auto-refresh

---

### 🔐 Enterprise User Management

Klarity includes a complete internal user management system — no external identity provider required.

- **bcrypt password hashing** (cost 12) — passwords never stored in plain text
- **Three roles** — admin, editor, viewer with different permission levels
- **Account security** — locked after 5 failed attempts (15 min), force password change on first login
- **JWT tokens** — 8-hour access tokens with 7-day refresh tokens
- **Persistent storage** — user accounts stored in a Kubernetes Secret (`klarity-users`), survives all pod restarts

---

## Quick Start

### Option 1 — kubectl (30 seconds)

```bash
kubectl apply -k https://github.com/selvarajmurugesan90/klarity/deploy/manifests

kubectl port-forward svc/klarity 8080:8080 -n klarity
```

Open [http://localhost:8080](http://localhost:8080) — Login: `admin` / `admin@123`

> ⚠ You will be required to change the default password on first login.

---

### Option 2 — Helm (Recommended for Production)

```bash
helm repo add klarity https://selvarajmurugesan90.github.io/charts
helm repo update

helm upgrade --install klarity klarity/klarity \
  --namespace klarity \
  --create-namespace \
  --set config.authMode=internal

kubectl port-forward svc/klarity 8080:8080 -n klarity
```

---

### Option 3 — Docker Compose (Local Development)

```bash
git clone https://github.com/selvarajmurugesan90/klarity
cd klarity
docker compose up
```

Open [http://localhost:8080](http://localhost:8080) — Uses `~/.kube/config`, no authentication required.

---

## Installation Guide

### Prerequisites

- Kubernetes **1.26+**
- `kubectl` configured with cluster access
- Helm 3.x *(Helm installation only)*

---

### Helm Installation

#### Default — Internal Auth

```bash
helm upgrade --install klarity klarity/klarity \
  --namespace klarity \
  --create-namespace \
  --set config.authMode=internal
```

#### Kubernetes Token Auth

```bash
helm upgrade --install klarity klarity/klarity \
  --namespace klarity \
  --create-namespace \
  --set config.authMode=token
```

Generate a token:
```bash
kubectl create token klarity -n klarity --duration=8h
```

#### OIDC / SSO

```bash
# Store client secret first
kubectl create secret generic oidc-secret \
  --from-literal=oidcClientSecret=<your-secret> \
  -n klarity

helm upgrade --install klarity klarity/klarity \
  --namespace klarity \
  --create-namespace \
  --set config.authMode=oidc \
  --set config.oidc.issuerURL=https://accounts.google.com \
  --set config.oidc.clientID=klarity \
  --set config.oidc.redirectURL=https://klarity.example.com/callback \
  --set oidcClientSecretRef.name=oidc-secret
```

Supported providers: **Google, GitHub, GitLab, Okta, Auth0, Keycloak, Azure AD, Dex**

#### Production Values Example

```yaml
# production-values.yaml
replicaCount: 2

config:
  authMode: internal
  logLevel: info
  logFormat: json
  sessionTimeout: 8h

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
  hosts:
    - host: klarity.company.internal
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: klarity-tls
      hosts:
        - klarity.company.internal

resources:
  requests:
    cpu: 200m
    memory: 256Mi
  limits:
    cpu: 1000m
    memory: 1Gi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 5

podDisruptionBudget:
  enabled: true
  minAvailable: 1
```

```bash
helm upgrade --install klarity klarity/klarity \
  --namespace klarity \
  --create-namespace \
  -f production-values.yaml
```

---

### kubectl / Kustomize Installation

```bash
# Apply all manifests
kubectl apply -k deploy/manifests/

# Check status
kubectl get all -n klarity

# Access
kubectl port-forward svc/klarity 8080:8080 -n klarity
```

**Custom namespace:**
```yaml
# kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - https://github.com/selvarajmurugesan90/klarity/deploy/manifests
namespace: my-ops-namespace
images:
  - name: ghcr.io/selvarajmurugesan90/klarity
    newTag: "1.0.1"
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       Browser                                    │
│                                                                  │
│   React 18 · TypeScript · Vite · Tailwind CSS · Zustand         │
│   TanStack Query · Monaco Editor · xterm.js · ReactFlow         │
│                                                                  │
│   REST  ──►  /api/v1/*         (Axios + TanStack Query)         │
│   WS    ──►  /ws/*             (native WebSocket)               │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────────────────┐
│                   Go Server (Gin)                                │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │    Auth     │  │  Audit Log   │  │   Port-Forward Proxy │   │
│  │  Middleware │  │  Middleware  │  │   (SPDY tunnel)      │   │
│  └─────────────┘  └──────────────┘  └──────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              ~150 Route Handlers                          │   │
│  │  Workloads · Networking · Storage · Config · RBAC        │   │
│  │  Policy · Cluster · GitOps · Search · Users · Audit      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         Kubernetes Client Manager                         │   │
│  │   client-go clientset  │  dynamic client                 │   │
│  │   discovery client     │  metrics client                 │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────┘
                           │ In-cluster SA token OR kubeconfig
┌──────────────────────────▼──────────────────────────────────────┐
│                 Kubernetes API Server                            │
│                                                                  │
│   GET /apis  ──►  discovers ALL resource types (60+)            │
│   metrics-server  ──►  CPU / Memory                             │
│   ArgoCD CRDs  ──►  auto-detected GitOps sync                   │
│   Flux CD CRDs  ──►  auto-detected reconciliation               │
│   Dynamic client  ──►  ANY CRD without code changes             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**In-cluster**: The pod uses its ServiceAccount token (mounted at `/var/run/secrets/kubernetes.io/serviceaccount/token`) — zero configuration.

**Out-of-cluster**: Falls back to `~/.kube/config` — all kubeconfig contexts loaded and switchable from the UI.

---

## Authentication

### Auth Modes

| Mode | Description | Best For |
|------|-------------|---------|
| `internal` | Username/password · bcrypt · JWT | Default — no external provider needed |
| `token` | Kubernetes ServiceAccount bearer token | K8s-native RBAC enforcement |
| `oidc` | OpenID Connect — Google, GitHub, Okta, Keycloak | Enterprise SSO |
| `none` | No authentication | Local dev / trusted internal network only |

### Internal Mode — User Roles

| Role | Read All Resources | Restart Workloads | Trigger CronJobs | Cordon/Drain Nodes | Manage Users |
|------|:-----------------:|:-----------------:|:----------------:|:-----------------:|:------------:|
| **admin** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **editor** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **viewer** | ✅ | ❌ | ❌ | ❌ | ❌ |

**Default accounts** (change passwords on first login):

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin@123` | Admin |
| `viewer` | `viewer@123` | Viewer |

### User Data Storage

User accounts are stored in a Kubernetes Secret (`klarity-users` in the `klarity` namespace), backed by etcd. Data persists across all pod restarts, rollouts, and Helm upgrades.

```bash
# Backup users
kubectl get secret klarity-users -n klarity -o yaml > users-backup.yaml

# Reset to defaults (recreated on next pod start)
kubectl delete secret klarity-users -n klarity
kubectl rollout restart deployment/klarity -n klarity
```

---

## Configuration Reference

| Environment Variable | Helm Value | Default | Description |
|---------------------|-----------|---------|-------------|
| `KD_AUTH_MODE` | `config.authMode` | `internal` | `internal` · `token` · `oidc` · `none` |
| `KD_LOG_LEVEL` | `config.logLevel` | `info` | `debug` · `info` · `warn` · `error` |
| `KD_LOG_FORMAT` | `config.logFormat` | `json` | `json` · `text` |
| `KD_SERVER_PORT` | `config.port` | `8080` | HTTP listen port |
| `KD_SERVER_DEFAULTNS` | `config.defaultNamespace` | `default` | Default namespace in UI |
| `KD_SERVER_SESSIONTIMEOUT` | `config.sessionTimeout` | `8h` | JWT token expiry |
| `KD_SERVER_MAXLOGLINES` | `config.maxLogLines` | `10000` | Max buffered log lines per stream |
| `KD_SERVER_METRICSENABLED` | `config.metricsEnabled` | `true` | Enable metrics-server integration |
| `KD_AUTH_OIDC_ISSUERURL` | `config.oidc.issuerURL` | — | OIDC provider discovery URL |
| `KD_AUTH_OIDC_CLIENTID` | `config.oidc.clientID` | — | OAuth2 client ID |

---

## Port Forwarding

Access any pod's service port directly in your browser — no `kubectl` needed.

1. Navigate to **Operations → Port Forwarding** in the sidebar
2. Click **New Port-Forward**
3. Select namespace, pod name, and remote port
4. Use the proxy URL to access the service

The dashboard creates a SPDY tunnel through the Kubernetes API and exposes the service via an HTTP reverse proxy. Active tunnels are listed with status indicators and direct browser links.

---

## Activities Panel

The **Activities Panel** is a persistent right-side drawer that keeps log streams and terminals running while you navigate between pages.

| Action | How |
|--------|-----|
| Open a log stream | Click 📄 on any pod row |
| Open a terminal | Click 🖥 on any pod row |
| Pin to Activities | Click "Pin to Activities" inside Pod detail → Logs/Terminal tab |
| Toggle panel | Click **"N active"** in the header, or press `g+a` |
| Switch sessions | Use the tab bar at the top of the panel |

---

## Multi-Cluster

```bash
# Create a Secret with multiple kubeconfig files
kubectl create secret generic multi-cluster \
  --from-file=production=~/.kube/prod.yaml \
  --from-file=staging=~/.kube/staging.yaml \
  -n klarity

# Reference it in Helm
helm upgrade klarity klarity/klarity \
  --namespace klarity \
  --set existingMultiClusterSecret=multi-cluster
```

Switch clusters using the dropdown in the top navigation bar. All contexts from each kubeconfig are loaded and switchable at runtime.

---

## Metrics Server

Klarity shows CPU and Memory utilization via `metrics-server`. Install if not present:

```bash
# Install metrics-server
kubectl apply -f \
  https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# For kind / minikube — disable TLS verification
kubectl patch deployment metrics-server -n kube-system \
  --type='json' \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'
```

Klarity gracefully shows "metrics unavailable" if metrics-server is not installed.

---

## Keyboard Shortcuts

Press `?` anywhere to open the full shortcuts overlay.

| Keys | Action | Keys | Action |
|------|--------|------|--------|
| `Ctrl+K` | Global Search | `?` | Show all shortcuts |
| `g o` | Overview | `g p` | Pods |
| `g d` | Deployments | `g s` | StatefulSets |
| `g v` | Services | `g i` | Ingresses |
| `g n` | Namespaces | `g N` | Nodes |
| `g e` | Events | `g a` | Audit Log |
| `g I` | Identity | `g h` | Health Report |
| `Esc` | Close modal/overlay | | |

---

## Security

Klarity is built with a security-first mindset:

| Security Control | Details |
|-----------------|---------|
| **Non-root container** | Runs as UID 1000 — never root |
| **Read-only root filesystem** | `readOnlyRootFilesystem: true` — no disk writes |
| **Capabilities** | `capabilities: drop: [ALL]` |
| **seccompProfile** | `RuntimeDefault` |
| **Secret masking** | Secret values always shown as `***` |
| **No server-side token storage** | Auth tokens exist only in browser session |
| **bcrypt passwords** | Cost factor 12 — computationally expensive to crack |
| **Account lockout** | 5 failed attempts → 15-minute lockout |
| **Read-only API** | No create/edit/delete for cluster configuration resources |
| **Stateless server** | Safe to restart anytime — no state lost |

See [SECURITY.md](SECURITY.md) for the vulnerability disclosure policy.

---

## Development

### Prerequisites

- Go 1.22+ — [golang.org](https://golang.org/doc/install)
- Node.js 22+ — [nodejs.org](https://nodejs.org)
- Docker — [docker.com](https://docs.docker.com/get-docker)
- Kubernetes cluster — [kind](https://kind.sigs.k8s.io/) recommended for local dev

### Run Locally

```bash
git clone https://github.com/selvarajmurugesan90/klarity
cd klarity

# Start backend + frontend with hot reload
make dev

# Backend:  http://localhost:8080  (auth=none, reads ~/.kube/config)
# Frontend: http://localhost:3000  (hot reload, proxied to backend)
```

### Build

```bash
make build           # Frontend + backend → bin/klarity
make docker-build    # Docker image → klarity:latest
make helm-package    # Helm chart → dist/klarity-*.tgz
make test            # Go tests + frontend tests
make lint            # golangci-lint + ESLint
```

### Project Structure

```
klarity/
├── cmd/server/             # Server entrypoint (main.go)
├── internal/
│   ├── api/
│   │   ├── handlers/       # HTTP handlers — one file per resource group
│   │   ├── middleware/     # Auth, logging, audit
│   │   └── routes.go       # All ~150 route registrations
│   ├── assets/             # Embedded React build (//go:embed)
│   ├── auth/               # User store, bcrypt, JWT
│   ├── config/             # Viper configuration
│   └── k8s/                # Client manager + discovery
├── web/                    # React frontend
│   └── src/
│       ├── components/     # Layout, common UI components
│       ├── pages/          # One page per resource type
│       ├── lib/            # API client, WebSocket, utilities
│       └── store/          # Zustand state
├── helm/klarity/           # Helm chart
├── deploy/manifests/       # Plain YAML + Kustomize
├── docs/                   # Detailed documentation
└── scripts/                # Helper scripts
```

---

## Compatibility

| Kubernetes Version | Status |
|-------------------|--------|
| 1.26 – 1.29 | ✅ Supported |
| 1.30 – 1.33 | ✅ Tested |
| 1.34+ | ⚡ Should work (untested) |

| Platform | Status |
|----------|--------|
| kind · minikube · k3s / k3d | ✅ Tested |
| Amazon EKS | ✅ Supported |
| Google GKE | ✅ Supported |
| Azure AKS | ✅ Supported |
| OpenShift | ⚡ Experimental |
| Rancher | ⚡ Experimental |

---

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Technical deep-dive — data flow, component design |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Complete deployment guide — Helm, kubectl, OIDC, multi-cluster |
| [USER_MANAGEMENT.md](docs/USER_MANAGEMENT.md) | User accounts, roles, API reference |
| [ROADMAP.md](docs/ROADMAP.md) | Planned features — Prometheus, Gateway API, Projects |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute |
| [SECURITY.md](SECURITY.md) | Security policy and vulnerability disclosure |
| [CHANGELOG.md](CHANGELOG.md) | Release history |

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a pull request.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Write tests for new functionality
4. Submit a Pull Request

Bug reports and feature requests: [GitHub Issues](https://github.com/selvarajmurugesan90/klarity/issues)

---

## License

```
Copyright 2026 Klarity Contributors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0
```

See [LICENSE](LICENSE) for the full license text.

---

<div align="center">

**Klarity** · Enterprise Kubernetes Observability · Apache 2.0

[GitHub](https://github.com/selvarajmurugesan90/klarity) · [Issues](https://github.com/selvarajmurugesan90/klarity/issues) · [Discussions](https://github.com/selvarajmurugesan90/klarity/discussions) · [Documentation](docs/)

</div>
