# ── Stage 1: Build React frontend ─────────────────────────────────────────────
FROM node:22-alpine AS frontend-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ ./
RUN npm run lint
RUN npm run build

# ── Stage 2: Build Go backend ──────────────────────────────────────────────────
FROM golang:1.22-alpine AS backend-builder
RUN apk add --no-cache git ca-certificates tzdata
WORKDIR /app
COPY go.mod ./
RUN go mod download || true
COPY . .
# Copy frontend build into the embed path expected by internal/assets/assets.go
COPY --from=frontend-builder /app/web/dist ./internal/assets/web/dist
RUN GONOSUMDB=* GOFLAGS=-mod=mod go mod tidy 2>/dev/null || true
ARG VERSION=dev
ARG GIT_COMMIT=unknown
ARG BUILD_DATE=unknown
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 GONOSUMDB=* GOFLAGS=-mod=mod go build \
    -ldflags="-s -w -X main.version=${VERSION} -X main.gitCommit=${GIT_COMMIT} -X main.buildDate=${BUILD_DATE}" \
    -o /kubernetes-dashboard ./cmd/server

# ── Stage 3: Final minimal image ───────────────────────────────────────────────
FROM alpine:3.20
LABEL org.opencontainers.image.title="Klarity" \
      org.opencontainers.image.description="Enterprise Kubernetes observability dashboard" \
      org.opencontainers.image.source="https://github.com/selvarajmurugesan90/klarity" \
      org.opencontainers.image.licenses="Apache-2.0"

RUN apk add --no-cache ca-certificates tzdata wget && \
    addgroup -g 1000 dashboard && \
    adduser -u 1000 -G dashboard -s /bin/sh -D dashboard && \
    mkdir -p /home/dashboard/.kube && \
    chown -R dashboard:dashboard /home/dashboard

COPY --from=backend-builder /kubernetes-dashboard /usr/local/bin/kubernetes-dashboard

USER 1000:1000
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD wget -qO- http://localhost:8080/healthz || exit 1

ENTRYPOINT ["/usr/local/bin/kubernetes-dashboard"]
