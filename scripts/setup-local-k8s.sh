#!/bin/bash
set -e

echo "🚀 Setting up Oblivion local Kubernetes environment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Verify prerequisites
echo -e "${BLUE}Step 1/6: Verifying prerequisites...${NC}"
command -v kind >/dev/null 2>&1 || { echo -e "${RED}❌ kind is not installed${NC}"; exit 1; }
command -v kubectl >/dev/null 2>&1 || { echo -e "${RED}❌ kubectl is not installed${NC}"; exit 1; }
command -v helm >/dev/null 2>&1 || { echo -e "${RED}❌ helm is not installed${NC}"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo -e "${RED}❌ docker is not installed${NC}"; exit 1; }

echo -e "${GREEN}✅ All prerequisites installed${NC}"
echo ""

# Step 2: Create kind cluster
echo -e "${BLUE}Step 2/6: Creating kind cluster...${NC}"
if kind get clusters | grep -q "oblivion"; then
  echo "⚠️  Cluster 'oblivion' already exists. Skipping creation."
else
  kind create cluster --config kind-config.yaml
  echo -e "${GREEN}✅ Kind cluster created${NC}"
fi
echo ""

# Step 3: Install Kong Ingress Controller
echo -e "${BLUE}Step 3/6: Installing Kong Ingress Controller...${NC}"
helm repo add kong https://charts.konghq.com >/dev/null 2>&1 || true
helm repo update >/dev/null 2>&1

if helm list -n kong | grep -q kong; then
  echo "⚠️  Kong already installed. Skipping."
else
  helm install kong kong/kong \
    -n kong \
    --create-namespace \
    --set ingressController.enabled=true \
    --set proxy.type=NodePort \
    --set proxy.http.nodePort=30080 \
    --set proxy.https.nodePort=30443 \
    --wait \
    --timeout 5m
  echo -e "${GREEN}✅ Kong Ingress Controller installed${NC}"
fi
echo ""

# Step 4: Install External Secrets Operator
echo -e "${BLUE}Step 4/6: Installing External Secrets Operator...${NC}"
helm repo add external-secrets https://charts.external-secrets.io >/dev/null 2>&1 || true
helm repo update >/dev/null 2>&1

if helm list -n external-secrets-system | grep -q external-secrets; then
  echo "⚠️  External Secrets Operator already installed. Skipping."
else
  helm install external-secrets \
    external-secrets/external-secrets \
    -n external-secrets-system \
    --create-namespace \
    --wait \
    --timeout 5m
  echo -e "${GREEN}✅ External Secrets Operator installed${NC}"
fi
echo ""

# Step 5: Deploy Oblivion infrastructure
echo -e "${BLUE}Step 5/6: Deploying Oblivion infrastructure (PostgreSQL, Redis, Qdrant)...${NC}"
cd infra/helm/oblivion

# Update Helm dependencies
helm dependency update >/dev/null 2>&1

if helm list -n oblivion | grep -q oblivion; then
  echo "⚠️  Oblivion already installed. Upgrading..."
  helm upgrade oblivion . \
    -f values-dev.yaml \
    -n oblivion \
    --wait \
    --timeout 10m
else
  helm install oblivion . \
    -f values-dev.yaml \
    -n oblivion \
    --create-namespace \
    --wait \
    --timeout 10m
fi

cd ../../..
echo -e "${GREEN}✅ Oblivion infrastructure deployed${NC}"
echo ""

# Step 6: Verify installation
echo -e "${BLUE}Step 6/6: Verifying installation...${NC}"
echo ""
echo "Checking pods..."
kubectl get pods -n oblivion
echo ""
kubectl get pods -n kong
echo ""
kubectl get pods -n external-secrets-system
echo ""

echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "📋 Quick Access Commands:"
echo "  PostgreSQL:  kubectl port-forward -n oblivion svc/oblivion-postgresql 5432:5432"
echo "  Redis:       kubectl port-forward -n oblivion svc/oblivion-redis-master 6379:6379"
echo "  Qdrant:      kubectl port-forward -n oblivion svc/oblivion-qdrant 6333:6333"
echo ""
echo "🎯 Next: Start developing in apps/nexus or apps/observer"
