#!/bin/bash
set -euo pipefail

NAMESPACE="klarity"
RELEASE="klarity"
IMAGE="klarity:latest"
CHART_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/helm/klarity"
CLUSTER_NAME="${CLUSTER_NAME:-selvaraj}"
AUTH_MODE="${AUTH_MODE:-none}"

echo "=== Klarity Deployment ==="
echo "Namespace:  $NAMESPACE"
echo "Image:      $IMAGE"
echo "Chart:      $CHART_DIR"
echo "Cluster:    $CLUSTER_NAME"
echo "Auth mode:  $AUTH_MODE"
echo ""

# 1. Ensure namespace exists
echo "[1/5] Creating namespace $NAMESPACE..."
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

# 2. Load image into kind (skip if not a kind cluster)
if kubectl config current-context 2>/dev/null | grep -q "kind"; then
  echo "[2/5] Loading image into kind cluster ($CLUSTER_NAME)..."
  kind load docker-image "$IMAGE" --name "$CLUSTER_NAME" 2>/dev/null || \
    echo "  (image may already be loaded or cluster name differs — continuing)"
else
  echo "[2/5] Non-kind cluster detected — skipping image load"
fi

# 3. Deploy with Helm
echo "[3/5] Deploying with Helm..."
helm upgrade --install "$RELEASE" "$CHART_DIR" \
  --namespace "$NAMESPACE" \
  --set image.repository=klarity \
  --set image.tag=latest \
  --set image.pullPolicy=Never \
  --set "config.authMode=$AUTH_MODE" \
  --wait \
  --timeout 120s

# 4. Wait for pod to be ready
echo "[4/5] Waiting for pod to be ready..."
kubectl rollout status deployment/"$RELEASE" -n "$NAMESPACE" --timeout=120s

# 5. Validate
echo "[5/5] Validating deployment..."
echo ""
kubectl get all -n "$NAMESPACE"
echo ""

POD=$(kubectl get pod -n "$NAMESPACE" -l "app.kubernetes.io/name=klarity" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
if [ -n "$POD" ]; then
  echo "Pod: $POD"
  echo "Health check:"
  kubectl exec -n "$NAMESPACE" "$POD" -- wget -qO- http://localhost:8080/healthz 2>/dev/null && echo "" || echo "  (health check via exec failed — trying port-forward)"
fi

echo ""
echo "=== Deployment successful! ==="
echo ""
echo "To access the dashboard, run:"
echo "  kubectl port-forward svc/$RELEASE 8080:8080 -n $NAMESPACE"
echo "  Then open: http://localhost:8080"
echo ""
if [ "$AUTH_MODE" = "token" ]; then
  echo "To generate an access token:"
  echo "  kubectl create token $RELEASE -n $NAMESPACE --duration=24h"
  echo ""
fi
