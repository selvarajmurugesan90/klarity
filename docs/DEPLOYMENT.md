# Deployment Guide

This guide covers production deployment options for the Klarity.

## Options

| Method | Best For | Complexity |
|--------|----------|-----------|
| Helm | Production clusters | Low |
| kubectl / Kustomize | Simple setups, GitOps | Low |
| Docker Compose | Local development | Very Low |

---

## Helm Deployment (Recommended)

### Add the Helm Repository
```bash
helm repo add klarity https://selvarajmurugesan90.github.io/klarity
helm repo update
```

### Install
```bash
helm upgrade --install klarity klarity/klarity \
  --namespace klarity \
  --create-namespace \
  --set config.authMode=internal
```

### Production Values Example
```yaml
# production-values.yaml
replicaCount: 2

image:
  repository: ghcr.io/selvarajmurugesan90/klarity
  tag: "1.0.0"

config:
  authMode: internal
  logLevel: info
  sessionTimeout: 8h

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
  hosts:
    - host: dashboard.internal.example.com
      paths: [{ path: /, pathType: Prefix }]
  tls:
    - secretName: dashboard-tls
      hosts: [dashboard.internal.example.com]

resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 512Mi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 5

podDisruptionBudget:
  enabled: true
  minAvailable: 1
```

```bash
helm upgrade --install klarity selvarajmurugesan90/klarity \
  --namespace klarity \
  --create-namespace \
  -f production-values.yaml
```

---

## kubectl / Kustomize Deployment

### Using kubectl apply
```bash
# Apply all manifests
kubectl apply -k https://github.com/selvarajmurugesan90/klarity/deploy/manifests

# Check status
kubectl get all -n klarity

# Access
kubectl port-forward svc/klarity 8080:8080 -n klarity
```

### Using local manifests
```bash
git clone https://github.com/selvarajmurugesan90/klarity
cd klarity

kubectl apply -k deploy/manifests/
```

### Customizing with Kustomize
```yaml
# kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - https://github.com/selvarajmurugesan90/klarity/deploy/manifests

patches:
  - target:
      kind: ConfigMap
      name: klarity
    patch: |
      - op: replace
        path: /data/KD_AUTH_MODE
        value: "oidc"
```

---

## Docker Compose (Local Development)

```bash
git clone https://github.com/selvarajmurugesan90/klarity
cd klarity

# Uses ~/.kube/config, auth mode: none
docker compose up

# Access http://localhost:8080
```

### Environment Variables Override
```yaml
# docker-compose.override.yaml
services:
  klarity:
    environment:
      - KD_AUTH_MODE=token
      - KD_LOG_LEVEL=debug
```

---

## Network Access Options

### Port Forward (Development)
```bash
kubectl port-forward svc/klarity 8080:8080 -n klarity
```

### NodePort
```bash
helm upgrade --install klarity selvarajmurugesan90/klarity \
  --namespace klarity \
  --set service.type=NodePort \
  --set service.nodePort=30080
```

### LoadBalancer
```bash
helm upgrade --install klarity selvarajmurugesan90/klarity \
  --namespace klarity \
  --set service.type=LoadBalancer
```

### Ingress with TLS
See production values example above. Requires cert-manager and an Ingress controller.

---

## Multi-Cluster Setup

Create a secret containing additional kubeconfig files:

```bash
# Create secret with named context files
kubectl create secret generic multi-cluster-configs \
  --from-file=production=~/.kube/prod.yaml \
  --from-file=staging=~/.kube/staging.yaml \
  --from-file=dev=~/.kube/dev.yaml \
  -n klarity

# Reference in Helm
helm upgrade klarity selvarajmurugesan90/klarity \
  --namespace klarity \
  --set existingMultiClusterSecret=multi-cluster-configs
```

Users switch clusters using the dropdown in the top navigation bar.

---

## OIDC Configuration

### Google
```yaml
config:
  authMode: oidc
  oidc:
    issuerURL: https://accounts.google.com
    clientID: <google-client-id>
    redirectURL: https://dashboard.example.com/callback
    scopes: openid,profile,email
```

### GitHub (via Dex)
```yaml
config:
  authMode: oidc
  oidc:
    issuerURL: https://dex.example.com
    clientID: klarity
    redirectURL: https://dashboard.example.com/callback
```

### Keycloak
```yaml
config:
  authMode: oidc
  oidc:
    issuerURL: https://keycloak.example.com/realms/kubernetes
    clientID: klarity
    redirectURL: https://dashboard.example.com/callback
```

Store the client secret separately:
```bash
kubectl create secret generic oidc-secret \
  --from-literal=oidcClientSecret=<your-secret> \
  -n klarity

# Reference in Helm
helm upgrade ... \
  --set oidcClientSecretRef.name=oidc-secret \
  --set oidcClientSecretRef.key=oidcClientSecret
```

---

## Metrics Server

CPU and Memory metrics require `metrics-server` to be installed:

```bash
# Install metrics-server
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# For kind/minikube (disable TLS verification)
kubectl patch deployment metrics-server -n kube-system \
  --type='json' \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'
```

The dashboard gracefully shows "Metrics unavailable" if metrics-server is not present.

---

## Resource Requirements

| Component | CPU Request | Memory Request | CPU Limit | Memory Limit |
|-----------|-------------|----------------|-----------|--------------|
| Dashboard server | 100m | 128Mi | 500m | 512Mi |

For clusters with many resources (> 500 pods), consider:
```yaml
resources:
  requests:
    cpu: 200m
    memory: 256Mi
  limits:
    cpu: 1000m
    memory: 1Gi
```

---

## Upgrading

### Helm Upgrade
```bash
helm repo update
helm upgrade klarity selvarajmurugesan90/klarity \
  --namespace klarity \
  --reuse-values
```

### kubectl Upgrade
```bash
kubectl set image deployment/klarity \
  klarity=ghcr.io/selvarajmurugesan90/klarity:NEW_VERSION \
  -n klarity
```

---

## Uninstalling

### Helm
```bash
helm uninstall klarity -n klarity
kubectl delete namespace klarity
```

### kubectl
```bash
kubectl delete -k deploy/manifests/
```

> **Note**: The user data and JWT secrets are stored in Kubernetes Secrets in the `klarity` namespace. Delete these manually if needed:
> ```bash
> kubectl delete secret klarity-users klarity-jwt-secret -n klarity
> ```
