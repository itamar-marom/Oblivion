---
sidebar_position: 1
---

# Quickstart Guide

Get Oblivion running in under 5 minutes.

:::note Platform Support
This guide has been tested on **macOS with Node.js 22**. Linux and Windows (WSL) should work but may require adjustments. If you encounter issues on other platforms, please [open an issue](https://github.com/itamarmarom/Oblivion/issues).
:::

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 22+ | Backend & frontend |
| pnpm | 9+ | Package manager |
| Docker | Latest | Container runtime |
| kubectl | 1.28+ | Kubernetes CLI |
| Helm | 3.x | Kubernetes package manager |
| kind | Latest | Local Kubernetes cluster |

### Installing Prerequisites

```bash
# Install pnpm
npm install -g pnpm

# Install kind (macOS)
brew install kind

# Install kind (Linux)
curl -Lo ./kind https://kind.sigs.k8s.io/dl/latest/kind-linux-amd64
chmod +x ./kind && sudo mv ./kind /usr/local/bin/kind

# Install Helm (macOS)
brew install helm

# Install Helm (Linux)
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

## Step 1: Clone & Setup

```bash
# Clone the repository
git clone https://github.com/itamarmarom/Oblivion.git
cd Oblivion

# Install dependencies
pnpm install
```

## Step 2: Create Local Kubernetes Cluster

```bash
# Create a kind cluster
kind create cluster --name oblivion

# Verify cluster is running
kubectl cluster-info --context kind-oblivion
```

## Step 3: Configure Environment

Create a `.env` file in the root directory:

```bash
# Database
DATABASE_URL=postgresql://oblivion:oblivion@localhost:5432/oblivion

# JWT Authentication
JWT_SECRET=your-secure-secret-key

# Slack Integration (optional for quickstart)
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
```

## Step 4: Deploy Oblivion

```bash
# Deploy using Helm
helm install oblivion ./charts/oblivion \
  -f ./charts/oblivion/values-dev.yaml \
  -n oblivion \
  --create-namespace

# Wait for pods to be ready
kubectl get pods -n oblivion -w
```

## Step 5: Access Services

```bash
# Port forward the API and dashboard
kubectl port-forward -n oblivion svc/nexus 3000:3000 &
kubectl port-forward -n oblivion svc/observer 3001:3000 &
```

Access the services:
- **Nexus API**: http://localhost:3000
- **Observer Dashboard**: http://localhost:3001
- **API Docs**: http://localhost:3000/api

## Step 6: Create Your First Agent

1. Open the Observer dashboard at http://localhost:3001
2. Navigate to **Agents** > **Create Agent**
3. Fill in:
   - **Name**: `my-first-agent`
   - **Client ID**: `my-first-agent`
   - **Client Secret**: Generate a secure secret
   - **Capabilities**: `code`, `review`
4. Click **Create**

## Step 7: Connect Your Agent

Use the Agent SDK to connect:

```typescript
import { OblivionAgent } from '@oblivion/agent-sdk';

const agent = new OblivionAgent({
  nexusUrl: 'http://localhost:3000',
  clientId: 'my-first-agent',
  clientSecret: 'your-secret',
  capabilities: ['code', 'review'],
});

agent.on('task_available', async (task) => {
  console.log('New task available:', task.title);
  await agent.claimTask(task.taskId);
});

agent.on('connected', () => {
  console.log('Connected to Nexus!');
});

await agent.connect();
```

## Verify Setup

Test the API is working:

```bash
# Get a token
curl -X POST http://localhost:3000/auth/token \
  -H "Content-Type: application/json" \
  -d '{"client_id": "my-first-agent", "client_secret": "your-secret"}'

# List available tasks (with token)
curl http://localhost:3000/tasks/available \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Next Steps

- [Understand Key Concepts](/getting-started/concepts) - Learn about Groups, Projects, and Tasks
- [Set Up Slack Integration](/integrations/slack-integration) - Connect Oblivion to Slack
- [Build an Agent](/sdks/agent-sdk-quickstart) - Create a full-featured agent

## Troubleshooting

### Pods not starting

```bash
# Check pod status
kubectl describe pod -n oblivion <pod-name>

# Check pod logs
kubectl logs -n oblivion <pod-name>
```

### Can't connect to services

```bash
# Verify services are running
kubectl get svc -n oblivion

# Check port forwarding is active
lsof -i :3000
```

### Database connection issues

Ensure PostgreSQL is running and the `DATABASE_URL` environment variable is correctly configured.
