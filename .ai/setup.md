# Build & Setup

**Purpose**: Comprehensive guide for setting up local development and deploying Oblivion to Kubernetes with Helm.

> ⚠️ **Note:** This document contains some outdated references to `api-python`, `api-node`, and `services/` directories from an earlier architecture. The current structure uses `apps/nexus` (NestJS) and `apps/observer` (Next.js). For accurate quickstart instructions, see:
> - GitHub Pages: [Quickstart Guide](../docs/docs/getting-started/quickstart.md)
> - Repository structure: [repository-structure.md](./repository-structure.md)
>
> **Helm Chart Location:** `./infra/helm/oblivion` (infrastructure only - no app manifests yet)

## Prerequisites

### Required Tools (Development)

| Tool | Version | Purpose |
|------|---------|---------|
| **Python** | 3.12+ | Python backend services |
| **Node.js** | 22+ | Node.js backend & frontend services |
| **uv** | Latest | Python package manager |
| **pnpm** | 9+ | Node.js package manager |
| **Docker Desktop** | Latest | Container runtime |
| **kubectl** | 1.28+ | Kubernetes CLI |
| **Helm** | 3.x | Kubernetes package manager |

### Required Tools (Deployment)

| Tool | Version | Purpose |
|------|---------|---------|
| **kubectl** | 1.28+ | Kubernetes CLI |
| **Helm** | 3.x | Kubernetes package manager |
| **kind/k3d/minikube** | Latest | Local Kubernetes cluster |

### Optional Tools (Recommended)

| Tool | Purpose |
|------|---------|
| **k9s** | Kubernetes TUI for easier cluster management |
| **kubectx/kubens** | Quick context and namespace switching |
| **stern** | Multi-pod log tailing |
| **skaffold** | Automated rebuild/deploy on code changes |
| **telepresence** | Hybrid local/k8s development |
| **helmfile** | Declarative Helm deployment management |

### Installation Guides

#### Install uv (Python)
```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

#### Install pnpm (Node.js)
```bash
npm install -g pnpm
```

#### Install kubectl
```bash
# macOS
brew install kubectl

# Linux
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/

# Windows
choco install kubernetes-cli
```

#### Install Helm
```bash
# macOS
brew install helm

# Linux
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Windows
choco install kubernetes-helm
```

#### Install kind (Local Kubernetes)
```bash
# macOS
brew install kind

# Linux
curl -Lo ./kind https://kind.sigs.k8s.io/dl/latest/kind-linux-amd64
chmod +x ./kind
sudo mv ./kind /usr/local/bin/kind

# Windows
choco install kind
```

## Local Development Setup

### Quick Start (5 Minutes)

Get Oblivion running in local Kubernetes:

```bash
# 1. Clone repository
git clone <repository-url>
cd oblivion

# 2. Create local Kubernetes cluster
kind create cluster --name oblivion

# 3. Install External Secrets Operator
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets \
  external-secrets/external-secrets \
  -n external-secrets-system \
  --create-namespace

# 4. Deploy Oblivion umbrella chart
helm install oblivion ./charts/oblivion \
  -f ./charts/oblivion/values-dev.yaml \
  --create-namespace \
  -n oblivion

# 5. Port forward services
kubectl port-forward -n oblivion svc/api 8000:8000 &
kubectl port-forward -n oblivion svc/web 3000:3000 &

# 6. Access services
# API: http://localhost:8000
# Web: http://localhost:3000
# API Docs: http://localhost:8000/docs
```

### Component-Specific Setup

#### Nexus (NestJS Backend)

```bash
# Navigate to Nexus
cd apps/nexus

# Install dependencies
pnpm install

# Run database migrations
pnpm prisma:migrate:dev

# Generate Prisma client
pnpm prisma:generate

# Run locally (connects to K8s infrastructure via port-forward)
pnpm start:dev

# Run tests
pnpm test

# Run linting
pnpm lint

# Run type checking
pnpm build
```

#### Observer (Next.js Dashboard)

```bash
# Navigate to Observer
cd apps/observer

# Install dependencies
pnpm install

# Run development server
pnpm dev

# Run tests
pnpm test

# Run E2E tests (Playwright)
pnpm test:e2e

# Build for production
pnpm build
```

#### Python SDK (Agent Development)

```bash
# Navigate to Python SDK
cd packages/sdk-python

# Install dependencies
uv sync --dev

# Run tests
uv run pytest

# Run linting
uv run ruff check .

# Run type checking
uv run mypy .
```

#### TypeScript SDK (Experimental)

```bash
# Navigate to TypeScript SDK
cd packages/agent-sdk

# Install dependencies
pnpm install

# Build package
pnpm build

# Type check
pnpm typecheck
```

### Monorepo Workspace Setup

#### Root-Level Configuration

```bash
# Install all workspace dependencies (from root)
pnpm install

# Python workspace
# Root pyproject.toml defines:
[tool.uv.workspace]
members = ["packages/sdk-python"]
```

#### Inter-Package Dependencies

**pnpm Workspace (Node.js):**
```json
// Root package.json
{
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
```

**TypeScript SDK usage:**
```json
// apps/nexus/package.json (if needed)
{
  "dependencies": {
    "@oblivion/agent-sdk": "workspace:*"
  }
}
```

## Local Kubernetes Setup

### Creating Local Cluster

#### Option 1: kind (Recommended)

```bash
# Create cluster with custom config
cat <<EOF > kind-config.yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: InitConfiguration
    nodeRegistration:
      kubeletExtraArgs:
        node-labels: "ingress-ready=true"
  extraPortMappings:
  - containerPort: 80
    hostPort: 80
    protocol: TCP
  - containerPort: 443
    hostPort: 443
    protocol: TCP
- role: worker
- role: worker
EOF

kind create cluster --name oblivion --config kind-config.yaml

# Verify cluster
kubectl cluster-info --context kind-oblivion
```

#### Option 2: k3d

```bash
# Create cluster with load balancer
k3d cluster create oblivion \
  --api-port 6550 \
  --servers 1 \
  --agents 3 \
  --port "80:80@loadbalancer" \
  --port "443:443@loadbalancer"

# Verify cluster
kubectl cluster-info
```

#### Option 3: minikube

```bash
# Start minikube with sufficient resources
minikube start \
  --driver=docker \
  --cpus=4 \
  --memory=8192 \
  --disk-size=50g

# Enable ingress addon
minikube addons enable ingress

# Verify cluster
kubectl cluster-info
```

### Installing Prerequisites

#### 1. External Secrets Operator

```bash
# Add Helm repository
helm repo add external-secrets https://charts.external-secrets.io
helm repo update

# Install External Secrets Operator
helm install external-secrets \
  external-secrets/external-secrets \
  -n external-secrets-system \
  --create-namespace \
  --wait

# Verify installation
kubectl get pods -n external-secrets-system
```

#### 2. Kong Ingress Controller

```bash
# Add Helm repository
helm repo add kong https://charts.konghq.com
helm repo update

# Install Kong Ingress Controller
helm install kong \
  kong/kong \
  -n kong \
  --create-namespace \
  --set ingressController.enabled=true \
  --set proxy.type=LoadBalancer \
  --wait

# Verify installation
kubectl get pods -n kong
```

#### 3. Cert-Manager (Optional - for TLS)

```bash
# Add Helm repository
helm repo add jetstack https://charts.jetstack.io
helm repo update

# Install cert-manager
helm install cert-manager \
  jetstack/cert-manager \
  -n cert-manager \
  --create-namespace \
  --set installCRDs=true \
  --wait

# Verify installation
kubectl get pods -n cert-manager
```

#### 4. Qdrant (Vector Store)

```bash
# Add Helm repository
helm repo add qdrant https://qdrant.github.io/qdrant-helm
helm repo update

# Install Qdrant
helm install qdrant \
  qdrant/qdrant \
  -n qdrant \
  --create-namespace \
  --set persistence.enabled=true \
  --set persistence.size=10Gi \
  --wait

# Verify installation
kubectl get pods -n qdrant

# Access Qdrant UI
kubectl port-forward -n qdrant svc/qdrant 6333:6333
# UI: http://localhost:6333/dashboard
```

#### 5. Langfuse (LLM Tracing)

```bash
# Add Helm repository
helm repo add langfuse https://langfuse.github.io/langfuse-k8s
helm repo update

# Install Langfuse
helm install langfuse \
  langfuse/langfuse \
  -n langfuse \
  --create-namespace \
  --set postgresql.enabled=true \
  --wait

# Verify installation
kubectl get pods -n langfuse

# Access Langfuse UI
kubectl port-forward -n langfuse svc/langfuse 3000:3000
# UI: http://localhost:3000
```

#### 6. Prometheus & Grafana (Optional - for monitoring)

```bash
# Add Helm repository
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install kube-prometheus-stack
helm install monitoring \
  prometheus-community/kube-prometheus-stack \
  -n monitoring \
  --create-namespace \
  --wait

# Access Grafana (default: admin/prom-operator)
kubectl port-forward -n monitoring svc/monitoring-grafana 3000:80
```

## Deploying Oblivion

### Umbrella Chart Structure

The Oblivion Helm chart currently deploys **infrastructure only** (PostgreSQL, Redis, Qdrant):

```
infra/helm/
└── oblivion/                   # Umbrella chart
    ├── Chart.yaml              # Chart metadata & dependencies
    ├── values.yaml             # Default values (base)
    ├── values-dev.yaml         # Development overrides
    ├── templates/              # Shared Kubernetes resources
    │   └── _helpers.tpl        # Template helpers
    └── charts/                 # Downloaded dependencies
        ├── postgresql-16.2.5.tgz  # Bitnami PostgreSQL
        ├── redis-20.5.0.tgz       # Bitnami Redis
        └── qdrant-0.9.4.tgz       # Qdrant vector store
```

**Note:** Nexus and Observer deployment manifests are not yet in the Helm chart. Applications run locally for development.

### Deploying to Local Kubernetes

#### First-Time Installation

```bash
# Ensure you're in the right context
kubectl config use-context kind-oblivion

# Install Oblivion infrastructure
helm install oblivion ./infra/helm/oblivion \
  -f ./infra/helm/oblivion/values-dev.yaml \
  -n oblivion \
  --create-namespace \
  --wait \
  --timeout 10m

# Verify deployment
helm list -n oblivion
kubectl get pods -n oblivion
kubectl get svc -n oblivion

# Expected: postgresql, redis-master, qdrant pods
```

#### Upgrading Deployment

```bash
# After making changes to charts or values
helm upgrade oblivion ./infra/helm/oblivion \
  -f ./infra/helm/oblivion/values-dev.yaml \
  -n oblivion \
  --wait

# Rollback if needed
helm rollback oblivion -n oblivion
```

#### Port Forward Infrastructure

```bash
# Port forward PostgreSQL
kubectl port-forward -n oblivion svc/oblivion-postgresql 5432:5432 &

# Port forward Redis
kubectl port-forward -n oblivion svc/oblivion-redis-master 6379:6379 &

# Port forward Qdrant
kubectl port-forward -n oblivion svc/oblivion-qdrant 6333:6333 &
```

### Helm Chart Commands

#### Validation & Debugging

```bash
# Lint chart for errors
helm lint ./infra/helm/oblivion

# Dry run (preview without applying)
helm install oblivion ./infra/helm/oblivion \
  -f ./infra/helm/oblivion/values-dev.yaml \
  --dry-run \
  --debug

# Render templates locally
helm template oblivion ./infra/helm/oblivion \
  -f ./infra/helm/oblivion/values-dev.yaml \
  > rendered-manifests.yaml

# Show computed values
helm get values oblivion -n oblivion

# Show all values (including defaults)
helm get values oblivion -n oblivion --all
```

#### Managing Releases

```bash
# List releases
helm list -n oblivion

# Get release status
helm status oblivion -n oblivion

# Get release history
helm history oblivion -n oblivion

# Rollback to previous version
helm rollback oblivion -n oblivion

# Rollback to specific revision
helm rollback oblivion 3 -n oblivion

# Uninstall release
helm uninstall oblivion -n oblivion
```

## External Secrets Operator

### Setup Secret Store

#### AWS Secrets Manager

```yaml
# charts/oblivion/templates/externalsecret-store.yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secrets-manager
  namespace: oblivion
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets-sa
```

```bash
# Create IAM role for ESO with permissions to read secrets
# Attach to Kubernetes service account
kubectl annotate serviceaccount external-secrets-sa \
  -n oblivion \
  eks.amazonaws.com/role-arn=arn:aws:iam::ACCOUNT:role/ESO-Role
```

#### HashiCorp Vault

```yaml
# charts/oblivion/templates/externalsecret-store.yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: vault-backend
  namespace: oblivion
spec:
  provider:
    vault:
      server: "https://vault.example.com"
      path: "secret"
      version: "v2"
      auth:
        kubernetes:
          mountPath: "kubernetes"
          role: "oblivion-role"
```

### Creating External Secrets

Each service defines its secrets via ExternalSecret resources:

```yaml
# charts/oblivion/charts/api-python/templates/externalsecret.yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: api-secrets
  namespace: oblivion
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: api-secrets  # Name of Kubernetes Secret to create
    creationPolicy: Owner
  data:
  - secretKey: DATABASE_URL
    remoteRef:
      key: oblivion/api/database-url
  - secretKey: JWT_SECRET
    remoteRef:
      key: oblivion/api/jwt-secret
  - secretKey: REDIS_URL
    remoteRef:
      key: oblivion/api/redis-url
```

### Managing Secrets

```bash
# Create secrets in AWS Secrets Manager
aws secretsmanager create-secret \
  --name oblivion/api/database-url \
  --secret-string "postgresql://user:pass@host:5432/db"

# Verify ExternalSecret is syncing
kubectl get externalsecrets -n oblivion
kubectl describe externalsecret api-secrets -n oblivion

# Check generated Kubernetes secret
kubectl get secret api-secrets -n oblivion
kubectl describe secret api-secrets -n oblivion

# View secret values (for debugging)
kubectl get secret api-secrets -n oblivion -o jsonpath='{.data.DATABASE_URL}' | base64 -d
```

## Development Workflow

### Running Services in Kubernetes

#### Accessing Services

```bash
# Port forward individual services
kubectl port-forward -n oblivion svc/api-python 8000:8000
kubectl port-forward -n oblivion svc/api-node 8001:8000
kubectl port-forward -n oblivion svc/web 3000:3000

# Or use multiple terminals / backgrounding
kubectl port-forward -n oblivion svc/api-python 8000:8000 &
kubectl port-forward -n oblivion svc/web 3000:3000 &

# Access services
# Python API: http://localhost:8000
# Node API: http://localhost:8001
# Frontend: http://localhost:3000
# API Docs: http://localhost:8000/docs
```

#### Viewing Logs

```bash
# Logs for specific deployment
kubectl logs -f -n oblivion deployment/api-python

# Logs for specific pod
kubectl logs -f -n oblivion <pod-name>

# Logs for all pods with label
kubectl logs -f -n oblivion -l app=api-python

# Multi-pod log tailing with stern
stern -n oblivion api-python

# Stream logs from all services
stern -n oblivion ".*"
```

#### Debugging Pods

```bash
# Exec into running pod
kubectl exec -it -n oblivion deployment/api-python -- /bin/sh

# Run one-off command
kubectl exec -n oblivion deployment/api-python -- env

# Describe pod for events and status
kubectl describe pod -n oblivion <pod-name>

# Get pod YAML
kubectl get pod -n oblivion <pod-name> -o yaml
```

#### Restarting Services

```bash
# Restart deployment (rolling restart)
kubectl rollout restart deployment/api-python -n oblivion

# Restart all deployments
kubectl rollout restart deployment -n oblivion --all

# Check rollout status
kubectl rollout status deployment/api-python -n oblivion

# Rollout history
kubectl rollout history deployment/api-python -n oblivion

# Rollback to previous version
kubectl rollout undo deployment/api-python -n oblivion
```

### Development with Hot Reload

#### Option 1: Develop Locally, Deploy to Test

```bash
# 1. Develop locally with hot reload
cd services/api
uv run uvicorn app.main:app --reload

# 2. When ready, build Docker image
docker build -t api-python:dev .

# 3. Load image into kind cluster
kind load docker-image api-python:dev --name oblivion

# 4. Upgrade Helm chart to use new image
helm upgrade oblivion ./charts/oblivion \
  -f values-dev.yaml \
  -n oblivion \
  --set api-python.image.tag=dev
```

#### Option 2: Skaffold (Automated)

```yaml
# skaffold.yaml (in service directory)
apiVersion: skaffold/v4beta6
kind: Config
build:
  artifacts:
  - image: api-python
    docker:
      dockerfile: Dockerfile
  local:
    push: false
    useBuildkit: true
deploy:
  helm:
    releases:
    - name: oblivion
      chartPath: ../../charts/oblivion
      valuesFiles:
      - ../../charts/oblivion/values-dev.yaml
      setValues:
        api-python.image.tag: dev
```

```bash
# Run Skaffold (auto-rebuild on changes)
skaffold dev
```

#### Option 3: Telepresence (Hybrid)

```bash
# Install Telepresence
brew install datawire/blackbird/telepresence

# Connect to cluster
telepresence connect

# Intercept service (replace k8s service with local)
telepresence intercept api-python \
  --port 8000:8000 \
  --env-file .env

# Run service locally (receives traffic from k8s)
uv run uvicorn app.main:app --reload --port 8000

# Stop intercept
telepresence leave api-python
```

### Testing in Kubernetes

```bash
# Run tests locally against services in k8s
kubectl port-forward -n oblivion svc/api-python 8000:8000

# In another terminal
cd services/api
export API_URL=http://localhost:8000
uv run pytest tests/integration/

# Run E2E tests against k8s services
cd services/web
export API_URL=http://localhost:8000
pnpm test:e2e
```

## Environment-Specific Deployments

### Development Environment

```bash
# Deploy to development namespace
helm upgrade --install oblivion ./charts/oblivion \
  -f ./charts/oblivion/values-dev.yaml \
  -n development \
  --create-namespace
```

**values-dev.yaml highlights:**
- Lower resource limits
- Single replica per service
- Debug logging enabled
- Local storage classes
- Development secrets from local SecretStore

### Staging Environment

```bash
# Deploy to staging namespace
helm upgrade --install oblivion ./charts/oblivion \
  -f ./charts/oblivion/values-staging.yaml \
  -n staging \
  --create-namespace
```

**values-staging.yaml highlights:**
- Production-like resources
- Multiple replicas (2-3)
- Production secrets from AWS/Vault
- Monitoring enabled
- Ingress with staging domain

### Production Environment

```bash
# Deploy to production namespace
kubectl config use-context production-cluster

helm upgrade --install oblivion ./charts/oblivion \
  -f ./charts/oblivion/values-prod.yaml \
  -n production \
  --create-namespace \
  --atomic \
  --wait \
  --timeout 15m

# Verify deployment
helm list -n production
kubectl get pods -n production
kubectl get ingress -n production
```

**values-prod.yaml highlights:**
- High resource limits
- Horizontal Pod Autoscaling (HPA)
- Multiple replicas (3-5+)
- Production secrets from AWS/Vault
- Full monitoring and alerting
- Production ingress with TLS
- PodDisruptionBudgets
- Resource quotas

## Configuration Management

### Values File Hierarchy

```yaml
# values.yaml (base defaults)
global:
  environment: development
  domain: oblivion.local
  imageRegistry: docker.io/oblivion

api-python:
  enabled: true
  replicaCount: 1
  image:
    repository: oblivion/api-python
    tag: latest
  resources:
    requests:
      cpu: 100m
      memory: 128Mi
    limits:
      cpu: 500m
      memory: 512Mi

# values-dev.yaml (override for dev)
global:
  environment: development
  domain: localhost

api-python:
  replicaCount: 1
  image:
    tag: dev
  resources:
    requests:
      cpu: 50m
      memory: 64Mi

# values-prod.yaml (override for prod)
global:
  environment: production
  domain: oblivion.com

api-python:
  replicaCount: 3
  image:
    tag: v1.0.0
  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 10
  resources:
    requests:
      cpu: 500m
      memory: 512Mi
    limits:
      cpu: 2000m
      memory: 2Gi
```

### ConfigMaps vs Secrets

**Use ConfigMaps for:**
- Non-sensitive configuration
- Feature flags
- API endpoints
- Public settings

```yaml
# ConfigMap example
apiVersion: v1
kind: ConfigMap
metadata:
  name: api-config
data:
  LOG_LEVEL: "info"
  API_VERSION: "v1"
  FEATURE_FLAG_NEW_UI: "true"
```

**Use ExternalSecrets for:**
- Database credentials
- API keys
- JWT secrets
- Third-party service credentials

```yaml
# ExternalSecret example (synced from AWS/Vault)
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: api-secrets
spec:
  secretStoreRef:
    name: aws-secrets-manager
  data:
  - secretKey: DATABASE_URL
    remoteRef:
      key: oblivion/api/database-url
```

## Cloud Deployment

### Deploying to AWS EKS

```bash
# Configure kubectl for EKS
aws eks update-kubeconfig --name oblivion-cluster --region us-east-1

# Verify connection
kubectl cluster-info

# Deploy production
helm upgrade --install oblivion ./charts/oblivion \
  -f ./charts/oblivion/values-prod.yaml \
  -n production \
  --create-namespace \
  --atomic \
  --wait \
  --timeout 15m

# Monitor deployment
kubectl get pods -n production -w
```

### Deploying to GCP GKE

```bash
# Configure kubectl for GKE
gcloud container clusters get-credentials oblivion-cluster --region us-central1

# Verify connection
kubectl cluster-info

# Deploy production
helm upgrade --install oblivion ./charts/oblivion \
  -f ./charts/oblivion/values-prod.yaml \
  -n production \
  --create-namespace \
  --atomic \
  --wait
```

### Deploying to Azure AKS

```bash
# Configure kubectl for AKS
az aks get-credentials --resource-group oblivion-rg --name oblivion-cluster

# Verify connection
kubectl cluster-info

# Deploy production
helm upgrade --install oblivion ./charts/oblivion \
  -f ./charts/oblivion/values-prod.yaml \
  -n production \
  --create-namespace \
  --atomic \
  --wait
```

## Troubleshooting

### Common Issues

#### Issue: Helm install/upgrade fails

```bash
# Check Helm chart syntax
helm lint ./charts/oblivion

# Dry run to see what would be applied
helm install oblivion ./charts/oblivion \
  --dry-run \
  --debug \
  -f values-dev.yaml

# Check Helm release status
helm status oblivion -n oblivion
```

#### Issue: Pods not starting (CrashLoopBackOff)

```bash
# Check pod logs
kubectl logs -n oblivion <pod-name>

# Check previous pod logs (if restarted)
kubectl logs -n oblivion <pod-name> --previous

# Describe pod for events
kubectl describe pod -n oblivion <pod-name>

# Common causes:
# - Missing environment variables
# - Database connection failures
# - Image pull errors
# - Resource limits too low
```

#### Issue: Image pull failures

```bash
# Check pod events
kubectl describe pod -n oblivion <pod-name>

# Verify image exists
docker pull <image-name>:<tag>

# For kind, load image manually
docker build -t api-python:latest .
kind load docker-image api-python:latest --name oblivion

# Update deployment
kubectl rollout restart deployment/api-python -n oblivion
```

#### Issue: External Secrets not syncing

```bash
# Check ESO operator is running
kubectl get pods -n external-secrets-system

# Check SecretStore configuration
kubectl get secretstore -n oblivion
kubectl describe secretstore aws-secrets-manager -n oblivion

# Check ExternalSecret status
kubectl get externalsecret -n oblivion
kubectl describe externalsecret api-secrets -n oblivion

# Check ESO logs
kubectl logs -n external-secrets-system deployment/external-secrets

# Verify secret was created
kubectl get secret api-secrets -n oblivion

# Common causes:
# - Incorrect IAM permissions
# - Wrong secret path/key in remote store
# - SecretStore misconfigured
# - Secret doesn't exist in remote store
```

#### Issue: Services can't communicate

```bash
# Check service endpoints
kubectl get svc -n oblivion
kubectl get endpoints -n oblivion

# Test service connectivity from within cluster
kubectl run -n oblivion debug --image=curlimages/curl --rm -it --restart=Never -- sh
# Inside pod:
curl http://api-python:8000/health

# Check NetworkPolicies (if any)
kubectl get networkpolicy -n oblivion
```

#### Issue: Ingress not working

```bash
# Check ingress resource
kubectl get ingress -n oblivion
kubectl describe ingress oblivion-ingress -n oblivion

# Check ingress controller
kubectl get pods -n kong

# For kind, verify ports are mapped correctly
docker ps | grep kind

# Test ingress
curl http://localhost/api/health
```

#### Issue: Out of resources

```bash
# Check node resources
kubectl top nodes

# Check pod resources
kubectl top pods -n oblivion

# Describe node for resource allocation
kubectl describe node

# Check resource quotas
kubectl get resourcequota -n oblivion

# Solutions:
# - Reduce resource requests in values file
# - Add more nodes to cluster
# - Scale down non-essential services
```

### Debug Commands Cheat Sheet

```bash
# Get all resources in namespace
kubectl get all -n oblivion

# Watch pods
kubectl get pods -n oblivion -w

# Port forward service
kubectl port-forward -n oblivion svc/api-python 8000:8000

# Execute command in pod
kubectl exec -n oblivion deployment/api-python -- env

# Interactive shell
kubectl exec -it -n oblivion deployment/api-python -- /bin/bash

# Copy files from pod
kubectl cp oblivion/<pod-name>:/app/logs/app.log ./local-app.log

# Copy files to pod
kubectl cp ./config.yaml oblivion/<pod-name>:/app/config.yaml

# Get events
kubectl get events -n oblivion --sort-by='.lastTimestamp'

# Delete stuck pod
kubectl delete pod -n oblivion <pod-name> --force --grace-period=0

# Restart deployment
kubectl rollout restart deployment/api-python -n oblivion

# Scale deployment
kubectl scale deployment/api-python --replicas=3 -n oblivion
```

### Cluster Management

```bash
# Switch between clusters
kubectl config get-contexts
kubectl config use-context kind-oblivion

# Switch namespace
kubectl config set-context --current --namespace=oblivion

# Or use kubens (if installed)
kubens oblivion

# View cluster info
kubectl cluster-info
kubectl get nodes
kubectl get namespaces

# Delete local cluster
kind delete cluster --name oblivion
k3d cluster delete oblivion
minikube delete
```

## Advanced Topics

### Helm Chart Development

```bash
# Create new subchart
helm create charts/oblivion/charts/new-service

# Package chart for distribution
helm package charts/oblivion

# Index charts for chart repository
helm repo index .

# Dependency management
cd charts/oblivion
helm dependency update
helm dependency list
```

### Monitoring & Observability

```bash
# Access Prometheus
kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090

# Access Grafana
kubectl port-forward -n monitoring svc/monitoring-grafana 3000:80

# Check ServiceMonitor resources
kubectl get servicemonitor -n oblivion
```

### Performance Tuning

```yaml
# HPA configuration in values
autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

# PodDisruptionBudget
podDisruptionBudget:
  enabled: true
  minAvailable: 2
```

## Quick Reference

### Common Workflows

**Daily Development:**
```bash
# 1. Start cluster (if stopped)
kind create cluster --name oblivion

# 2. Deploy latest changes
helm upgrade oblivion ./charts/oblivion -f values-dev.yaml -n oblivion

# 3. Port forward
kubectl port-forward -n oblivion svc/api 8000:8000 &
kubectl port-forward -n oblivion svc/web 3000:3000 &

# 4. Develop locally
cd services/api && uv run uvicorn app.main:app --reload
```

**Updating a Service:**
```bash
# 1. Build new Docker image
docker build -t api-python:v1.2.0 services/api

# 2. Load into kind
kind load docker-image api-python:v1.2.0 --name oblivion

# 3. Upgrade Helm release
helm upgrade oblivion ./charts/oblivion \
  --set api-python.image.tag=v1.2.0 \
  -n oblivion
```

**Debugging a Failing Pod:**
```bash
# 1. Get pod name
kubectl get pods -n oblivion | grep api

# 2. Check logs
kubectl logs -n oblivion <pod-name>

# 3. Check events
kubectl describe pod -n oblivion <pod-name>

# 4. Exec into pod
kubectl exec -it -n oblivion <pod-name> -- /bin/sh
```

## Additional Resources

- **[Repository Structure](./repository-structure.md)** - Monorepo organization
- **[Backend Python](./backend-python.md)** - FastAPI service details
- **[Backend Node](./backend-node.md)** - Hono service details
- **[Frontend](./frontend.md)** - Next.js service details
- **[Testing](./testing.md)** - Testing standards

### External Documentation

- [Helm Documentation](https://helm.sh/docs/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [External Secrets Operator](https://external-secrets.io/)
- [kind Documentation](https://kind.sigs.k8s.io/)
- [k3d Documentation](https://k3d.io/)

---

*This setup guide evolves with deployment patterns. See [self-improvement.md](./self-improvement.md) for improvement suggestions.*

**Last Updated**: Initial version - 2026-01-02
