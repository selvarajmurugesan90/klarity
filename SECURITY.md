# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | ✅ Current |

## Reporting a Vulnerability

**Please do NOT open a public GitHub issue for security vulnerabilities.**

To report a security issue, please use **[GitHub Private Vulnerability Reporting](https://github.com/selvarajmurugesan90/klarity/security/advisories/new)**.

This keeps your report private and visible only to the maintainers.

Include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes

You will receive a response within **48 hours** acknowledging the report.  
We will work with you to understand and address the issue before public disclosure.

## Security Considerations

### Authentication
- The `none` auth mode disables all authentication — **only use on trusted internal networks or via `kubectl port-forward`**
- Internal user passwords are hashed with bcrypt (cost 12) — never stored in plain text
- JWT tokens expire after 8 hours; refresh tokens after 7 days
- Accounts are locked after 5 consecutive failed login attempts

### Data Access
- The dashboard is **read-only by design** for cluster resources — no create/edit/delete exposed in the UI
- Secret values are masked (`***`) by default in all views
- The server never stores Kubernetes tokens — they exist only in the browser session

### Network
- Recommended: deploy behind TLS-terminating Ingress (HTTPS only)
- The port-forward proxy binds to `127.0.0.1` only (not `0.0.0.0`)
- No external network calls (except OIDC provider discovery)

### RBAC
- The dashboard's ServiceAccount uses explicit permission lists (not wildcards on write verbs)
- Review `deploy/manifests/rbac.yaml` before deploying in security-sensitive environments
