# User Management Guide

This guide covers the dashboard's internal user management system (auth mode: `internal`).

## Overview

When `authMode=internal`, the dashboard maintains its own user store backed by a Kubernetes Secret.
No external identity provider is required.

**Users are persisted in**: `klarity-users` Secret in the `klarity` namespace.  
**JWT signing key is in**: `klarity-jwt-secret` Secret.

---

## Roles

| Role | What They Can Do |
|------|-----------------|
| **admin** | Read all resources · Restart deployments · Cordon/drain nodes · Trigger CronJobs · Manage users |
| **editor** | Read all resources · Restart deployments · Trigger CronJobs |
| **viewer** | Read-only access to all cluster resources |

All roles can:
- View any resource (YAML, events, metrics)
- Stream pod logs
- Open pod terminals
- Use port forwarding
- View the cluster health report

---

## Default Accounts

| Username | Password | Role | Note |
|----------|----------|------|------|
| `admin` | `admin@123` | Admin | Change password on first login |
| `viewer` | `viewer@123` | Viewer | Change password on first login |

**Important**: Both default accounts have `mustChangePassword: true`. Users will be prompted to set a new password before accessing the dashboard.

---

## Creating Users

### Via the UI (Admin only)

1. Go to **Settings → User Management**
2. Click **New User**
3. Fill in:
   - **Username** (lowercase, no spaces)
   - **Display Name**
   - **Email** (optional)
   - **Role** (admin / editor / viewer)
   - **Password** (min 8 characters, shown with strength meter)
4. Click **Create User**

### Via the API
```bash
# Get an admin token first
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/internal/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}' | \
  jq -r '.data.accessToken')

# Create a viewer user
curl -X POST http://localhost:8080/api/v1/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john",
    "displayName": "John Doe",
    "email": "john@example.com",
    "password": "SecurePass123!",
    "role": "viewer"
  }'
```

---

## Managing Users

### Reset Password (Admin)
```bash
curl -X PUT http://localhost:8080/api/v1/users/{user-id}/reset-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"newPassword": "TempPass456!"}'
```

The user will be prompted to change this password on next login.

### Unlock Locked Account (Admin)
```bash
curl -X POST http://localhost:8080/api/v1/users/{user-id}/unlock \
  -H "Authorization: Bearer $TOKEN"
```

### Deactivate User (Admin)
```bash
curl -X PUT http://localhost:8080/api/v1/users/{user-id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"active": false}'
```

---

## Security Features

### Password Requirements
- Minimum 8 characters
- Maximum 128 characters
- Hashed with bcrypt (cost factor 12) — computationally expensive to brute-force

### Account Lockout
After 5 consecutive failed login attempts, an account is locked for **15 minutes**.  
Admins can unlock accounts immediately via the UI or API.

### Session Tokens
- **Access token**: Valid for 8 hours (configurable via `KD_SERVER_SESSIONTIMEOUT`)
- **Refresh token**: Valid for 7 days (stored as httpOnly cookie)
- Tokens are revoked on logout (added to in-memory blocklist)
- Token blocklist is cleared on pod restart — users may need to re-login after a pod restart

### Audit Trail
All user management operations are logged in the audit log:
- Login (success and failure)
- User creation, update, deletion
- Password changes
- Account unlock

---

## API Reference

All user management endpoints require an `admin` role.

### List Users
```
GET /api/v1/users
Authorization: Bearer <admin-token>
```

### Get User
```
GET /api/v1/users/:id
```

### Create User
```
POST /api/v1/users
Content-Type: application/json

{
  "username": "string",
  "displayName": "string",
  "email": "string (optional)",
  "password": "string (min 8 chars)",
  "role": "admin|editor|viewer"
}
```

### Update User
```
PUT /api/v1/users/:id
Content-Type: application/json

{
  "displayName": "string (optional)",
  "email": "string (optional)",
  "role": "admin|editor|viewer (optional)",
  "active": "boolean (optional)",
  "mustChangePassword": "boolean (optional)"
}
```

### Delete User
```
DELETE /api/v1/users/:id
```
Cannot delete the last active admin account.  
Cannot delete your own account.

### Change Password (self)
```
PUT /api/v1/auth/me/password
Content-Type: application/json

{
  "currentPassword": "string",
  "newPassword": "string (min 8 chars)"
}
```

### Admin Reset Password
```
PUT /api/v1/users/:id/reset-password
Content-Type: application/json

{
  "newPassword": "string (min 8 chars)"
}
```

### Unlock Account
```
POST /api/v1/users/:id/unlock
```

---

## User Data Storage

User data is stored as JSON in a Kubernetes Secret:

```bash
# View users (shows hashed passwords)
kubectl get secret klarity-users -n klarity \
  -o jsonpath='{.data.users\.json}' | base64 -d | jq .
```

```json
[
  {
    "id": "18b5902262666d2d",
    "username": "admin",
    "displayName": "Administrator",
    "passwordHash": "$2a$12$...",
    "role": "admin",
    "active": true,
    "mustChangePassword": false,
    "createdAt": "2024-01-01T00:00:00Z",
    "lastLoginAt": "2024-06-01T10:00:00Z"
  }
]
```

### Backup User Data
```bash
kubectl get secret klarity-users \
  -n klarity -o yaml > users-backup.yaml
```

### Restore User Data
```bash
kubectl apply -f users-backup.yaml
kubectl rollout restart deployment/klarity -n klarity
```

### Reset to Defaults
```bash
# Deletes all users — creates default admin/viewer on next restart
kubectl delete secret klarity-users -n klarity
kubectl rollout restart deployment/klarity -n klarity
```
