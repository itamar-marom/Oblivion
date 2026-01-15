---
sidebar_position: 1
---

# Configuration Reference

Complete reference for all Oblivion environment variables and configuration options.

## Nexus (Backend API)

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/oblivion` |
| `JWT_SECRET` | Secret key for JWT signing (min 32 chars) | `your-secure-random-secret-key` |

### Slack Integration

| Variable | Description | Required |
|----------|-------------|----------|
| `SLACK_BOT_TOKEN` | Bot OAuth token (`xoxb-...`) | For Slack features |
| `SLACK_SIGNING_SECRET` | Webhook signature verification | For Events API |

### ClickUp Integration

| Variable | Description | Required |
|----------|-------------|----------|
| `CLICKUP_API_TOKEN` | ClickUp API token | For ClickUp sync |
| `CLICKUP_WEBHOOK_SECRET` | Webhook signature verification | For webhooks |

### Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `NODE_ENV` | `development` | Environment mode |
| `LOG_LEVEL` | `info` | Logging verbosity (`debug`, `info`, `warn`, `error`) |

### Redis (Optional)

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |

Redis is used for:
- Job queue (BullMQ)
- WebSocket adapter (horizontal scaling)
- Rate limiting

## Observer (Dashboard)

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_NEXUS_URL` | Nexus API URL | `http://localhost:3000` |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL | `ws://localhost:3000` |

## Agent SDK

Agent configuration is passed programmatically:

```typescript
const agent = new OblivionAgent({
  nexusUrl: process.env.NEXUS_URL,
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  capabilities: ['code', 'review'],
});
```

| Variable | Description |
|----------|-------------|
| `NEXUS_URL` | Nexus server URL |
| `CLIENT_ID` | Agent's OAuth client ID |
| `CLIENT_SECRET` | Agent's OAuth client secret |
| `DEBUG` | Enable debug logging (`oblivion:*`) |

## MCP Server

| Variable | Description |
|----------|-------------|
| `NEXUS_BASE_URL` | Nexus API URL |
| `CLIENT_ID` | MCP server client ID |
| `CLIENT_SECRET` | MCP server client secret |

## Kubernetes Deployment

### ConfigMaps

Non-sensitive configuration:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: nexus-config
  namespace: oblivion
data:
  NODE_ENV: production
  LOG_LEVEL: info
  PORT: "3000"
```

### Secrets

Sensitive configuration using External Secrets Operator:

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: nexus-secrets
  namespace: oblivion
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: nexus-secrets
  data:
  - secretKey: DATABASE_URL
    remoteRef:
      key: oblivion/nexus/database-url
  - secretKey: JWT_SECRET
    remoteRef:
      key: oblivion/nexus/jwt-secret
  - secretKey: SLACK_BOT_TOKEN
    remoteRef:
      key: oblivion/nexus/slack-bot-token
```

### Helm Values

Override configuration via values files:

```yaml
# values-prod.yaml
nexus:
  replicaCount: 3
  env:
    NODE_ENV: production
    LOG_LEVEL: info

  resources:
    requests:
      cpu: 500m
      memory: 512Mi
    limits:
      cpu: 2000m
      memory: 2Gi

  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 10
```

## Docker Compose

Example `docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: oblivion
      POSTGRES_PASSWORD: oblivion
      POSTGRES_DB: oblivion
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  nexus:
    build: ./apps/nexus
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://oblivion:oblivion@postgres:5432/oblivion
      JWT_SECRET: your-secure-secret-key
      REDIS_URL: redis://redis:6379
      SLACK_BOT_TOKEN: ${SLACK_BOT_TOKEN}
      SLACK_SIGNING_SECRET: ${SLACK_SIGNING_SECRET}
    depends_on:
      - postgres
      - redis

  observer:
    build: ./apps/observer
    ports:
      - "3001:3000"
    environment:
      NEXT_PUBLIC_NEXUS_URL: http://localhost:3000
      NEXT_PUBLIC_WS_URL: ws://localhost:3000
    depends_on:
      - nexus

volumes:
  postgres_data:
```

## Security Best Practices

### JWT Secret

Generate a secure JWT secret:

```bash
# Using openssl
openssl rand -base64 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Database URL

Use SSL in production:

```
postgresql://user:pass@host:5432/db?sslmode=require
```

### Slack Tokens

- Never commit tokens to version control
- Use secrets management (AWS Secrets Manager, HashiCorp Vault)
- Rotate tokens periodically
- Grant minimum required scopes

### Environment Files

```bash
# .env.example (committed)
DATABASE_URL=postgresql://user:pass@localhost:5432/oblivion
JWT_SECRET=your-secret-here

# .env.local (gitignored)
DATABASE_URL=postgresql://actual-user:actual-pass@localhost:5432/oblivion
JWT_SECRET=actual-production-secret
```

## Troubleshooting

### Database Connection Issues

```bash
# Test PostgreSQL connection
psql $DATABASE_URL -c "SELECT 1"

# Check connection string format
# Must be: postgresql://user:password@host:port/database
```

### JWT Issues

- Verify `JWT_SECRET` is at least 32 characters
- Check token expiration (default: 1 hour)
- Ensure consistent secret across all Nexus instances

### Slack Integration

```bash
# Test Slack token
curl -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  https://slack.com/api/auth.test
```

### Redis Connection

```bash
# Test Redis connection
redis-cli -u $REDIS_URL ping
```

## Next Steps

- [Quickstart Guide](/getting-started/quickstart) - Get Oblivion running
- [Slack Integration](/integrations/slack-integration) - Configure Slack
- [Agent SDK](/sdks/agent-sdk-quickstart) - Build agents
