REGISTRY     ?= ghcr.io/viavi-solutions
IMAGE_NAME   ?= kubernetes-dashboard
VERSION      ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
GIT_COMMIT   ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_DATE   ?= $(shell date -u +"%Y-%m-%dT%H:%M:%SZ")
IMAGE        := $(REGISTRY)/$(IMAGE_NAME):$(VERSION)
BINARY       := bin/kubernetes-dashboard

.PHONY: all build build-frontend build-backend run dev test lint docker-build docker-push \
        helm-package helm-install helm-uninstall generate-manifests clean

all: build

build: build-frontend build-backend

build-frontend:
	@echo "► Building frontend..."
	cd web && npm ci && npm run build

build-backend:
	@echo "► Building backend (with embedded frontend)..."
	@mkdir -p bin internal/assets/web
	@cp -r web/dist internal/assets/web/dist
	CGO_ENABLED=0 go build \
		-ldflags="-s -w -X main.version=$(VERSION) -X main.gitCommit=$(GIT_COMMIT) -X main.buildDate=$(BUILD_DATE)" \
		-o $(BINARY) ./cmd/server

run: build
	KD_AUTH_MODE=none KD_LOG_LEVEL=debug ./$(BINARY)

dev:
	@echo "► Starting backend + frontend dev servers..."
	@(cd web && npm run dev) & \
	 KD_AUTH_MODE=none KD_LOG_LEVEL=debug go run ./cmd/server

test:
	@echo "► Running Go tests..."
	go test ./... -v -count=1
	@echo "► Running frontend tests..."
	cd web && npm test -- --run

lint:
	@echo "► Linting Go..."
	golangci-lint run ./...
	@echo "► Linting frontend..."
	cd web && npm run lint

docker-build:
	docker build \
		--build-arg VERSION=$(VERSION) \
		--build-arg GIT_COMMIT=$(GIT_COMMIT) \
		--build-arg BUILD_DATE=$(BUILD_DATE) \
		-t $(IMAGE) .

docker-push: docker-build
	docker push $(IMAGE)

helm-package:
	helm package helm/kubernetes-dashboard --destination dist/

helm-install:
	helm upgrade --install kubernetes-dashboard helm/kubernetes-dashboard \
		--namespace kubernetes-dashboard \
		--create-namespace \
		--set image.tag=$(VERSION)

helm-uninstall:
	helm uninstall kubernetes-dashboard -n kubernetes-dashboard

generate-manifests:
	@mkdir -p dist
	helm template kubernetes-dashboard helm/kubernetes-dashboard \
		--namespace kubernetes-dashboard > dist/kubernetes-dashboard.yaml

clean:
	rm -rf bin/ web/dist dist/
