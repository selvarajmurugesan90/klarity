# Architecture

## Overview

The Klarity is a single-binary Go application that embeds a React frontend.  
It acts as an authenticated proxy between the browser and the Kubernetes API.

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Client)                        │
│  React 18 · TypeScript · Vite · Tailwind CSS · Zustand      │
│                                                             │
│  REST  →  /api/v1/*          (TanStack Query, Axios)        │
│  WS    →  /ws/*              (xterm.js, LogViewer)          │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS
┌────────────────────────▼────────────────────────────────────┐
│                    Go Server (Gin)                           │
│                                                             │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────────┐   │
│  │ Auth         │  │ Audit Log   │  │ Port Forward     │   │
│  │ Middleware   │  │ Middleware  │  │ (SPDY proxy)     │   │
│  └──────────────┘  └─────────────┘  └──────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │               Route Handlers                          │   │
│  │  /api/v1/pods     /api/v1/deployments   /api/v1/...  │   │
│  │  /api/v1/gitops   /api/v1/portforward   /ws/logs     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            Kubernetes Client Manager                  │   │
│  │  client-go clientset  │  dynamic client              │   │
│  │  discovery client     │  metrics client              │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS (in-cluster SA token or kubeconfig)
┌────────────────────────▼────────────────────────────────────┐
│              Kubernetes API Server                           │
│                                                             │
│  GET /apis  →  discovers ALL resource types                 │
│  metrics-server  →  CPU/Memory                              │
│  ArgoCD CRDs  →  GitOps sync status                        │
│  Flux CD CRDs →  GitOps reconciliation                     │
└─────────────────────────────────────────────────────────────┘
```

## Backend

### Technology
- **Language**: Go 1.22
- **HTTP Framework**: Gin (high-performance, middleware-based)
- **Kubernetes client**: `k8s.io/client-go` (official Go client)
- **Dynamic client**: For CRDs and unknown resource types
- **WebSocket**: Gorilla WebSocket
- **Auth**: `github.com/golang-jwt/jwt/v5` + `golang.org/x/crypto/bcrypt`
- **Configuration**: Viper (env vars + config file)
- **Logging**: Logrus (structured JSON)

### Key Packages
```
internal/
├── api/
│   ├── handlers/       # One file per resource group
│   │   ├── workloads.go    # Deployments, StatefulSets, DaemonSets, Jobs, CronJobs
│   │   ├── pods.go         # Pods + log streaming
│   │   ├── networking.go   # Services, Ingresses, NetworkPolicies
│   │   ├── storage.go      # PVs, PVCs, StorageClasses, CSI
│   │   ├── config.go       # ConfigMaps, Secrets, ServiceAccounts
│   │   ├── rbac.go         # Roles, ClusterRoles, Bindings
│   │   ├── cluster.go      # Nodes, Namespaces, Events
│   │   ├── policy.go       # HPAs, PDBs, Webhooks, CRDs
│   │   ├── dynamic.go      # Generic dynamic resource access
│   │   ├── websocket.go    # Log/exec/events WebSocket handlers
│   │   ├── portforward.go  # Port-forward tunnel management
│   │   ├── gitops.go       # ArgoCD + Flux CD integration
│   │   ├── search.go       # Global cross-resource search
│   │   ├── audit.go        # Mutation audit log
│   │   ├── metrics.go      # metrics-server integration
│   │   ├── identity.go     # RBAC identity management + quota
│   │   ├── reports.go      # Cluster health HTML report
│   │   ├── overview.go     # Cluster overview aggregation
│   │   └── users.go        # Internal user CRUD
│   ├── middleware/
│   │   ├── auth.go         # JWT/token/OIDC/none auth middleware
│   │   └── logger.go       # Structured request logging
│   └── routes.go           # All route registrations (~150 routes)
├── assets/                 # Embedded React build (//go:embed)
├── auth/
│   ├── user.go             # User model, bcrypt, K8s Secret storage
│   └── jwt.go              # JWT sign/verify/refresh/revoke
├── config/
│   └── config.go           # Viper configuration
└── k8s/
    └── client.go           # Multi-cluster manager + discovery
```

### Resource Discovery

On startup, the backend calls `GET /apis` to enumerate every API group, version, and resource type the cluster supports. This includes:
- All standard Kubernetes resources
- Any installed CRDs (Istio, ArgoCD, Prometheus Operator, Cert-Manager, etc.)

```go
lists, err := client.DiscoveryClient.ServerPreferredResources()
// Returns 60+ resource types from a standard cluster
// Returns 200+ from a cluster with many operators installed
```

The dynamic client can then list/get any discovered resource without code changes.

### Authentication Flow

```
Request arrives
    │
    ├── Auth mode: none    → pass-through, synthetic admin role
    ├── Auth mode: internal → validate JWT, extract user + role
    ├── Auth mode: token    → TokenReview API (K8s RBAC)
    └── Auth mode: oidc     → verify OIDC JWT
         │
         └── Role check (internal mode):
              ├── admin  → all methods
              ├── editor → GET + POST/PUT/PATCH (except RBAC resources)
              └── viewer → GET only
```

### Audit Middleware

All mutating requests (POST, PUT, PATCH, DELETE) are recorded in an in-memory ring buffer (2000 events):

```go
AuditEvent{
    Timestamp, User, Action, Resource, Namespace, Name, Path, Status
}
```

The ring buffer is reset on pod restart. For persistent audit logging, ship pod logs to your log aggregation stack — the server emits structured JSON for every request.

## Frontend

### Technology
- **Framework**: React 18 + TypeScript
- **Build**: Vite 6 (fast bundling, code splitting)
- **Styling**: Tailwind CSS v3
- **Data fetching**: TanStack Query v5 (cache, background sync, auto-refetch)
- **State**: Zustand (auth, cluster, activities, settings)
- **Charts**: Recharts
- **YAML editor**: Monaco Editor (VS Code editor, read-only)
- **Terminal**: xterm.js + FitAddon
- **Network graph**: @xyflow/react (lazily loaded)
- **Icons**: Lucide React

### State Management

```
stores/
├── auth.ts         # Token, user profile, auth mode, mustChangePw
├── cluster.ts      # Selected cluster/namespace, namespace list
├── activities.ts   # Active log streams, terminals, port-forwards
└── settings.ts     # UI preferences, Helm repos, webhooks (localStorage)
```

### Activities Panel Architecture

The Activities Panel is a persistent right-side panel that survives page navigation:

```
ActivityStore (Zustand)
    activities: Activity[]   # log | terminal | portforward
    panelOpen: boolean
    activeId: string

ActivityPanel (component)
    ├── Tab bar (one tab per activity)
    ├── Resize handle
    └── Active content:
         ├── LogViewer   (WebSocket connection)
         ├── Terminal    (WebSocket exec)
         └── PortForwardView (shows proxy URL)
```

## Data Flow: Log Streaming

```
User clicks "Stream Logs"
    │
    ├── addLog() called in ActivityStore
    │   → Activity added, panel opens
    │
    └── LogViewer component renders
        │
        └── WSClient connects to /ws/logs/:namespace/:pod
             │
             └── Go handler: PodLogOptions{Follow: true}
                  │
                  └── Kubernetes API streams logs
                       │
                       └── WebSocket frames → LogViewer
                            │
                            └── Severity filter, keyword filter, render
```

## Data Flow: Port Forwarding

```
User creates port-forward
    │
    └── POST /api/v1/portforward {namespace, podName, remotePort}
         │
         └── Go handler:
              ├── Verify pod exists and is Running
              ├── Allocate random local port (49152-65535)
              ├── Create SPDY dialer using client-go/transport/spdy
              ├── Start portforward.ForwardPorts() in goroutine
              ├── Wait for readyCh (max 10s)
              └── Return {id, localPort, proxyPath}
                   │
                   └── Frontend: show proxy URL
                        │
                        └── User accesses: /api/v1/portforward/proxy/{id}/path
                             │
                             └── httputil.ReverseProxy → 127.0.0.1:{localPort}/path
                                  │
                                  └── SPDY tunnel → pod:remotePort
```

## Security Model

The dashboard is **stateless** and **read-heavy** by design:

- **No cluster state modified** by the dashboard itself (except emergency ops: restart, cordon)
- **No secrets stored** on the server — tokens live only in browser session storage
- **JWT signing key** stored in a Kubernetes Secret — consistent across pod restarts
- **User passwords** stored as bcrypt hashes in a Kubernetes Secret
- **Audit trail** for all mutations (ring buffer in memory, emitted to pod logs)
- **Network isolation**: The dashboard only talks to the Kubernetes API — no external calls except OIDC discovery
