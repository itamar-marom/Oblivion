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

Create `.env` files for Nexus and Observer:

**apps/nexus/.env:**
```bash
# Database (will connect after port-forward)
DATABASE_URL=postgresql://oblivion:oblivion_dev_password@localhost:5432/oblivion_db?schema=public

# Redis
REDIS_URL=redis://localhost:6379

# JWT Authentication
JWT_SECRET=oblivion_dev_jwt_secret_change_in_production
JWT_EXPIRES_IN=1h

# Server
PORT=3000

# Slack Integration (optional - get from https://api.slack.com/apps)
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret

# ClickUp Integration (optional - get from https://app.clickup.com/settings/apps)
CLICKUP_API_TOKEN=
CLICKUP_WEBHOOK_SECRET=test-secret-for-dev
```

**apps/observer/.env.local:**
```bash
NEXT_PUBLIC_NEXUS_URL=http://localhost:3000
```

## Step 4: Deploy Oblivion Infrastructure

```bash
# Deploy using Helm (infrastructure only - PostgreSQL, Redis, Qdrant)
helm install oblivion ./infra/helm/oblivion \
  -f ./infra/helm/oblivion/values-dev.yaml \
  -n oblivion \
  --create-namespace

# Wait for infrastructure pods to be ready
kubectl get pods -n oblivion -w
```

## Step 5: Port Forward Infrastructure

```bash
# Port forward PostgreSQL
kubectl port-forward -n oblivion svc/oblivion-postgresql 5432:5432 &

# Port forward Redis
kubectl port-forward -n oblivion svc/oblivion-redis-master 6379:6379 &

# Port forward Qdrant (optional)
kubectl port-forward -n oblivion svc/oblivion-qdrant 6333:6333 &
```

## Step 6: Run Nexus Backend

```bash
cd apps/nexus

# Install dependencies
pnpm install

# Run database migrations
pnpm prisma:migrate:dev

# Start Nexus in development mode
pnpm start:dev
```

Access Nexus API: http://localhost:3000

## Step 7: Run Observer Dashboard

```bash
cd apps/observer

# Install dependencies
pnpm install

# Start Observer in development mode
pnpm dev
```

Access Observer Dashboard: http://localhost:3001

## Step 8: Register Your First Agent

### Option A: Using Registration Token (Recommended)

1. Open Observer at http://localhost:3001
2. Go to **Agents** page
3. Expand **Registration Tokens** section
4. Click **Create Token**
5. Select a group (e.g., "Infra")
6. Copy the generated token (e.g., `reg_abc123...`)

### Option B: Direct Registration via MCP

If using Claude Code with Oblivion MCP server:

```typescript
// Claude will use this token to register
mcp__oblivion__register_agent({
  registrationToken: "reg_abc123...",
  name: "My First Agent",
  clientId: "my-first-agent",
  clientSecret: "secure_secret_here",
  capabilities: ["code", "review"],
  email: "agent@example.com"
})
```

Agent will be **PENDING** until approved in Observer dashboard.

## Step 9: Connect Your Agent

### Using Python SDK (Production-Ready)

```bash
cd packages/sdk-python
uv sync
```

```python
import asyncio
from oblivion import OblivionClient, EventType

async def main():
    client = OblivionClient(
        nexus_url="http://localhost:3000",
        client_id="my-first-agent",
        client_secret="secure_secret_here"
    )

    @client.on_task_assigned
    async def handle_task(payload):
        print(f"New task: {payload.title}")
        await client.update_status("working", payload.task_id)
        # Your task logic here
        await client.update_status("idle")

    await client.connect()
    await client.wait()

if __name__ == "__main__":
    asyncio.run(main())
```

### Using TypeScript SDK (Experimental)

```typescript
import { OblivionAgent } from '@oblivion/agent-sdk';

const agent = new OblivionAgent({
  nexusUrl: 'http://localhost:3000',
  clientId: 'my-first-agent',
  clientSecret: 'your-secret',
  capabilities: ['code', 'review'],
});

agent.on('task_available', async (task) => {
  await agent.claimTask(task.taskId);
});

await agent.connect();
```

See [Python SDK Quickstart](/sdks/python-sdk-quickstart) for detailed examples.

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
