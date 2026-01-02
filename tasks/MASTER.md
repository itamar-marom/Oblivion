# 📋 MASTER TASK LIST: Project Oblivion

| Metadata | Details |
| :--- | :--- |
| **Document Owner** | Engineering Lead |
| **Scope** | End-to-End Implementation |
| **Methodology** | Kubernetes-Native / Trunk-Based Development |
| **Status** | 🟢 Live |

---

## 🏁 Phase 0: The Kubernetes Foundation (Local & scaffold)
**Goal:** A running K8s cluster on your laptop that mirrors production, with all "plumbing" services installed.

### 0.1 Repository & Monorepo Setup
- [ ] **Init Monorepo:** Set up.
    - `apps/nexus`: NestJS (Backend).
    - `apps/observer`: Next.js (Dashboard).
    - `packages/sdk-python`: Python Library.
    - `infra/helm`: Helm charts and manifests.
- [ ] **Standardization:** Configure shared `tsconfig`, `eslint`, and `prettier` packages.
- [ ] **CI Skeleton:** Create a dummy GitHub Action to verify the build passes.

### 0.2 Local Kubernetes Cluster (The "Skaffold")
- [ ] **Cluster Init:** Install `Kind`.
- [ ] **Dev Tooling:** Configure **Telepresence**.
- [ ] **Ingress Controller:** Install `kong` in the local cluster to route `oblivion.local` domains.

### 0.3 Infrastructure Services (Helm)
- [ ] **Database:** Install `postgresql` (Bitnami Chart).
    - Config: Create `init.sql` for `oblivion_db`.
- [ ] **Cache/Queue:** Install `redis` (Bitnami Chart).
    - Config: Disable persistence for local dev speed.
- [ ] **Vector Store:** Install `qdrant` (Official Chart).
- [ ] **LLM Tracing:** Install `langfuse` (Self-hosted Chart).
- [ ] **Secret Management:** Install `external-secrets` operator (stubbed for local, ready for AWS SSM in prod).

---

## 🧠 Phase 1: The Nexus Core (Backend Plumbing)
**Goal:** The Backend pod is alive, connected to the DB, and ready to authenticate Agents.

### 1.1 Database Schema & ORM
- [ ] **Prisma Setup:** Initialize Prisma in `apps/nexus`.
- [ ] **Schema Definition:** Implement the SQL tables from `INTEGRATION_SPEC.md`.
    - `Tenant`, `Agent`, `ProjectMapping`, `TaskMapping`, `AgentAlias`.
- [ ] **Migration Script:** Create a K8s Job that runs `prisma migrate deploy` on pod startup.

### 1.2 Authentication Module (OAuth2)
- [ ] **Client Credentials Flow:** Implement `POST /auth/token`.
    - Input: `client_id`, `client_secret`.
    - Output: `access_token` (JWT).
- [ ] **Auth Guard:** Create a NestJS Guard that validates JWTs.
- [ ] **Seed Script:** Create a CLI script to generate a valid `client_id/secret` pair for your first local agent.

### 1.3 The WebSocket Gateway (The "Air Traffic Control")
- [ ] **Socket.io Gateway:** Initialize `@WebSocketGateway` in NestJS.
- [ ] **Connection Logic:**
    - Validate JWT in handshake.
    - Store `socket_id` -> `agent_id` mapping in Redis (for multi-pod scaling).
- [ ] **Heartbeat:** Implement server-side ping/pong. Disconnect sockets that are silent > 30s.

---

## 🔗 Phase 2: The Integration Engine (Logic Layer)
**Goal:** Webhooks flow from ClickUp/Slack into the system and get routed.

### 2.1 The Ingestion Queue (BullMQ)
- [ ] **Queue Setup:** Create `webhook-processing` queue in Redis.
- [ ] **Producer:** Create an API endpoint `POST /webhooks/:source` that immediately dumps payload to Redis (return 200 OK instantly).
- [ ] **Consumer:** Create a separate Worker Processor that parses the JSON.

### 2.2 The "Mirror" Logic (ClickUp -> Slack)
- [ ] **ClickUp Parser:**
    - Detect `taskCreated`.
    - Extract Description.
    - Regex Match: Find `@AI_Squad`.
- [ ] **Routing Logic:**
    - Query Postgres: `SELECT slack_channel_id FROM project_mappings WHERE clickup_list_id = ?`.
- [ ] **Slack Client:**
    - Implement `postMessage` with Block Kit (The "Root Message").
    - Store the resulting `ts` (Timestamp) in `task_mappings` table.

### 2.3 The "Sync" Logic (Slack -> ClickUp)
- [ ] **Slack Parser:**
    - Listen for `message.channels`.
    - Ignore bot messages (loop prevention).
    - Check for `thread_ts`.
- [ ] **Lookup:**
    - Query Postgres: Find `clickup_task_id` associated with this `thread_ts`.
- [ ] **ClickUp Client:**
    - Implement `postComment`.
    - Filter: Only sync if message has specific metadata or keyword (per Product Spec).

---

## 🤖 Phase 3: The Agent Ecosystem
**Goal:** A standalone Python container that can connect, think, and act.

### 3.1 Python SDK (`oblivion-client`)
- [ ] **Socket Client:** implement `AsyncSocketIO` wrapper with auto-reconnect.
- [ ] **Typed Events:** Create Pydantic models for `TaskAssigned`, `ContextUpdate`.
- [ ] **Decorators:** Implement `@agent.on_task("fix_bug")` syntax.

### 3.2 Agent Containerization
- [ ] **Dockerfile:** Create a lightweight Python base image.
- [ ] **Env Vars:** Define standard `GITHUB_TOKEN`, `OBLIVION_URI`, `AGENT_SECRET` injection.
    - *Note:* The Platform does NOT manage the GitHub token. It is injected into the Agent's K8s Pod via Secret.

### 3.3 The "Local" Agent (Reference Implementation)
- [ ] **LangGraph Setup:** Build a simple State Graph (Start -> Read -> Think -> Act).
- [ ] **Tooling (MCP):**
    - Integrate `mcp-server-github`.
    - Verify Agent can read a repo using its *own* injected token.
- [ ] **Context Search:** Implement the SDK call `agent.search_history()` which hits the Nexus Qdrant API.

---

## 🖥️ Phase 4: The Observer (Frontend)
**Goal:** Visibility. (Built last because you can debug Phases 1-3 via logs).

### 4.1 Dashboard Foundation
- [ ] **Next.js Setup:** Initialize App Router project.
- [ ] **Auth:** Configure Clerk or NextAuth (mocked for local dev).
- [ ] **API Client:** Generate generic `fetch` wrappers for the Nexus API.

### 4.2 Configuration Screens
- [ ] **Mapping UI:**
    - Left col: ClickUp Lists (fetched from API).
    - Right col: Slack Channels (fetched from API).
    - Action: "Link" button that writes to Postgres.
- [ ] **Agent Roster:** Read-only view of the `Agents` table + Redis Online Status.

### 4.3 The Live Feed
- [ ] **Socket Client (FE):** Connect Dashboard to Nexus via a special `/admin` namespace.
- [ ] **Log Component:** Render streaming text logs from the backend event bus.

---

## 🛡️ Phase 5: Production Hardening
**Goal:** Moving from "It works on my machine" to "It scales."

### 5.1 Observability
- [ ] **OpenTelemetry:** Add auto-instrumentation to Nexus (NestJS).
- [ ] **Prometheus/Grafana:** Install K8s charts to scrape metrics.
- [ ] **Langfuse Prod:** Switch from local container to Langfuse Cloud (or persistent self-hosted).

### 5.2 Resilience
- [ ] **Rate Limiting:** Configure `ThrottlerGuard` in NestJS (Redis-backed).
- [ ] **Circuit Breaker:** Implement logic to "Mute" an Agent if it sends > 10 messages/min.
- [ ] **Disaster Recovery:** Verify that if Redis dies, the system reconnects automatically.
