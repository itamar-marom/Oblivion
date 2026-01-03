#!/bin/bash

echo "📊 Oblivion Kubernetes Environment Status"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if cluster exists
if ! kind get clusters | grep -q "oblivion"; then
  echo -e "${RED}❌ Kind cluster 'oblivion' not found${NC}"
  echo ""
  echo "Run: ./scripts/setup-local-k8s.sh"
  exit 1
fi

echo -e "${GREEN}✅ Kind cluster 'oblivion' exists${NC}"
echo ""

# Check cluster nodes
echo -e "${BLUE}Cluster Nodes:${NC}"
kubectl get nodes
echo ""

# Check Oblivion pods
echo -e "${BLUE}Oblivion Infrastructure Pods:${NC}"
kubectl get pods -n oblivion
echo ""

# Check Kong
echo -e "${BLUE}Kong Ingress:${NC}"
kubectl get pods -n kong
echo ""

# Check External Secrets
echo -e "${BLUE}External Secrets Operator:${NC}"
kubectl get pods -n external-secrets-system
echo ""

# Check services
echo -e "${BLUE}Services:${NC}"
kubectl get svc -n oblivion
echo ""

# Port forward commands
echo -e "${BLUE}Quick Access Commands:${NC}"
echo "  PostgreSQL:  kubectl port-forward -n oblivion svc/oblivion-postgresql 5432:5432"
echo "  Redis:       kubectl port-forward -n oblivion svc/oblivion-redis-master 6379:6379"
echo "  Qdrant UI:   kubectl port-forward -n oblivion svc/oblivion-qdrant 6333:6333"
echo "               Then visit: http://localhost:6333/dashboard"
echo ""

# Helm releases
echo -e "${BLUE}Helm Releases:${NC}"
helm list -n oblivion
echo ""

echo -e "${GREEN}✅ Environment is healthy!${NC}"
