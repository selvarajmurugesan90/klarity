# Roadmap

This document outlines planned features and improvements for future releases.

## v1.1 — Observability Depth

- [ ] **Prometheus integration** — Query in-cluster Prometheus for historical CPU/memory graphs, custom metrics, and time-series charts in workload detail views
- [ ] **AlertManager alerts** — Show firing AlertManager alerts alongside Kubernetes events
- [ ] **Full resource relationship graph** — Complete ownership chain: Ingress → Service → Deployment → ReplicaSet → Pod with status badges
- [ ] **Label-based search** — Search using label selector syntax (`app=nginx, env=prod`)
- [ ] **Rollback for DaemonSets and StatefulSets** — Currently only Deployments support rollback; extend to all workload types
- [ ] **Ephemeral debug containers** — Attach a debug sidecar to a running pod without restarting it (`kubectl debug` equivalent)

## v1.2 — Enterprise Platform Features

- [ ] **Projects / Application grouping** — Group multiple namespaces and label selectors into a named "application" view for multi-team clusters
- [ ] **K8s RBAC-aware UI** — Use `SelfSubjectAccessReview` to hide/disable buttons based on the user's actual K8s RBAC permissions (for token mode)
- [ ] **a8r.io annotation support** — Render `a8r.io/docs`, `a8r.io/runbook`, `a8r.io/slack` as clickable links in resource detail views
- [ ] **OpenCost integration** — Show estimated monthly cost per deployment/namespace

## v1.3 — Gateway API & Modern Networking

- [ ] **HTTPRoute support** — First-class pages for Kubernetes Gateway API `HTTPRoute` resources
- [ ] **GRPCRoute support** — Full parity with HTTPRoute for gRPC services
- [ ] **Gateway resource** — List and view `Gateway` resources (the new networking standard replacing Ingress)

## v2.0 — AI & Extensibility

- [ ] **AI Assistant (optional)** — Natural language cluster queries powered by user-supplied LLM API keys; no data sent without user consent
- [ ] **Plugin system** — Allow third-party extensions to add custom pages, sidebar entries, and table columns
- [ ] **Dark mode** — Full dark theme toggle
- [ ] **i18n** — Chinese, Spanish, German, Japanese translations

## Non-Goals

The following will NOT be added to this dashboard:

- **Direct YAML editing / apply** — Use GitOps tools (ArgoCD, Flux) for configuration changes
- **Resource creation wizards** — Resources should be defined in Git, not created ad-hoc
- **Delete operations** — Use `kubectl` or GitOps for destructive operations
- **Desktop app (Electron)** — This is a web-first dashboard deployed in-cluster
