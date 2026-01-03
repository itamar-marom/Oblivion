#!/bin/bash
set -e

echo "🗑️  Tearing down Oblivion local Kubernetes environment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Confirm deletion
echo -e "${YELLOW}⚠️  This will delete:${NC}"
echo "  - Kind cluster 'oblivion' and all resources"
echo "  - All deployed services (PostgreSQL, Redis, Qdrant, etc.)"
echo "  - Persistent volumes and data"
echo ""
read -p "Are you sure you want to continue? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

echo ""

# Step 1: Delete Helm releases (optional, but cleaner)
echo -e "${BLUE}Step 1/2: Uninstalling Helm releases...${NC}"

if helm list -n oblivion | grep -q oblivion; then
  helm uninstall oblivion -n oblivion
  echo -e "${GREEN}✅ Uninstalled oblivion${NC}"
else
  echo "⚠️  Oblivion release not found. Skipping."
fi

if helm list -n kong | grep -q kong; then
  helm uninstall kong -n kong
  echo -e "${GREEN}✅ Uninstalled kong${NC}"
else
  echo "⚠️  Kong release not found. Skipping."
fi

if helm list -n external-secrets-system | grep -q external-secrets; then
  helm uninstall external-secrets -n external-secrets-system
  echo -e "${GREEN}✅ Uninstalled external-secrets${NC}"
else
  echo "⚠️  External Secrets release not found. Skipping."
fi

echo ""

# Step 2: Delete kind cluster
echo -e "${BLUE}Step 2/2: Deleting kind cluster...${NC}"

if kind get clusters | grep -q "oblivion"; then
  kind delete cluster --name oblivion
  echo -e "${GREEN}✅ Kind cluster deleted${NC}"
else
  echo "⚠️  Cluster 'oblivion' not found. Skipping."
fi

echo ""
echo -e "${GREEN}✅ Teardown complete!${NC}"
echo ""
echo "To recreate the environment, run: ./scripts/setup-local-k8s.sh"
