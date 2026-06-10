# Contributing to Klarity

Thank you for your interest in contributing! This guide covers everything you need to get started.

## Ways to Contribute

- **Bug reports** — Open an issue with steps to reproduce
- **Feature requests** — Open an issue with the use case and expected behavior
- **Code** — Bug fixes, new features, performance improvements
- **Documentation** — Improve README, add examples, fix typos
- **Testing** — Test on different Kubernetes distros and report findings

## Development Setup

### Requirements
- Go 1.22+
- Node.js 22+
- Docker
- A Kubernetes cluster (kind is recommended for local dev)

### First-time setup

```bash
git clone https://github.com/selvarajmurugesan90/klarity
cd klarity

# Start everything in dev mode
make dev
```

This starts:
- Go backend on `:8080` (reads your `~/.kube/config`, auth mode: none)
- React frontend on `:3000` with hot reload, proxied to backend

### Running tests

```bash
make test   # All tests
make lint   # Linting
```

## Code Structure

```
internal/api/handlers/   ← One file per resource group (workloads.go, networking.go, etc.)
internal/k8s/client.go   ← Kubernetes client manager + discovery
web/src/pages/           ← One page per resource type
web/src/components/      ← Reusable UI components
```

## Adding a New Resource Type

Most new resources are one-liners using the generic component:

**Backend** — add a handler in the appropriate file:
```go
func (h *Handler) ListMyResource(c *gin.Context) {
    client, ok := h.client(c)
    if !ok { return }
    list, err := client.Clientset.SomeV1().MyResources(nsParam(c, parseListParams(c))).List(...)
    // ... standard pattern
}
```

**Routes** — register in `internal/api/routes.go`

**Frontend** — add a page in `web/src/pages/`:
```tsx
export default function MyResources() {
  return (
    <GenericResourcePage
      title="My Resources"
      queryKey="myresources"
      fetchFn={(ns, p) => api.list(ns, p)}
      deleteFn={(ns, name) => api.delete(ns, name)}
    />
  )
}
```

## Pull Request Guidelines

1. **One PR per concern** — don't mix unrelated changes
2. **Write tests** for new backend handlers
3. **Update the README** if you add a major feature
4. **Keep the PR description clear** — explain what and why, not just what

## Commit Style

```
feat: add port-forwarding handler
fix: resolve Gin route conflict for namespace params
docs: add OIDC setup example to README
refactor: extract common pagination helper
```

## Reporting Security Issues

Please **do not** open a public GitHub issue for security vulnerabilities.  
Use [GitHub Private Vulnerability Reporting](https://github.com/selvarajmurugesan90/klarity/security/advisories/new) instead.

## License

By contributing, you agree your contributions are licensed under Apache 2.0.
