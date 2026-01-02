# Architecture & Design

**Purpose**: Comprehensive system architecture documentation for the Oblivion orchestration platform.

**Reference**: See [`../product/PRD.md`](../product/PRD.md) for detailed product requirements.

---

## System Architecture

Oblivion operates on a **Hub-and-Spoke** model, where the Nexus (hub) routes events between external tools (ClickUp, Slack) and AI Agents (spokes).

### High-Level Architecture Diagram

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   ClickUp   │◄────────┤   Oblivion   ├────────►│    Slack    │
│   (Tasks)   │  Webhook│    Nexus     │ WebSocket│  (Context)  │
└─────────────┘         │              │         └─────────────┘
                        │  WebSocket   │
                        │   Gateway    │
                        └───────┬──────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
                    ▼           ▼           ▼
              ┌─────────┐ ┌─────────┐ ┌─────────┐
              │ Agent 1 │ │ Agent 2 │ │ Agent N │
              │(Python) │ │(Python) │ │(Python) │
              └─────────┘ └─────────┘ └─────────┘
```

## Core Components

### 1. The Nexus (Backend - NestJS)

**Purpose**: Central hub that orchestrates all communication between tools and agents.

**Responsibilities**:
- **Webhook Ingestion**: Receive webhooks from ClickUp and Slack
- **Event Routing**: Route events to appropriate agents via WebSocket
- **Message Mirroring**: Sync messages between Slack and ClickUp
- **Agent Registry**: Track connected agents and their capabilities
- **Tool Gateway**: Proxy secure tool execution for agents

**Technology Stack**:
- **Framework**: NestJS (Node.js)
- **Database**: PostgreSQL (via Prisma ORM)
- **Queue**: BullMQ (Redis-backed)
- **WebSocket**: Socket.io
- **Auth**: OAuth 2.0 Client Credentials

**Key Modules**:
```
apps/nexus/
├── src/
│   ├── auth/               # OAuth2 authentication
│   ├── webhooks/           # ClickUp/Slack webhook handlers
│   ├── gateway/            # WebSocket gateway
│   ├── agents/             # Agent registry and management
│   ├── mappings/           # Project/Task mappings
│   ├── queue/              # BullMQ processors
│   ├── integrations/       # ClickUp/Slack API clients
│   └── tools/              # Tool gateway for secure execution
```

### 2. The Memory Bank (Vector Store - Qdrant)

**Purpose**: Enable agents to perform RAG (Retrieval Augmented Generation) for context awareness.

**Responsibilities**:
- **Ingestion**: Embed Slack messages asynchronously (< 5s delay)
- **Summarization**: Generate thread summaries every 50 messages
- **Context Retrieval**: Provide relevant context to agents on request
- **Project Isolation**: Agents can only search documents/chats linked to their project

**Technology Stack**:
- **Vector DB**: Qdrant
- **Embedding**: OpenAI embeddings (or self-hosted model)
- **Storage**: Persistent volumes in Kubernetes

**Indexing Strategy**:
- **Collections**: One per Workgroup (Tenant)
- **Metadata**: `project_id`, `task_id`, `thread_ts`, `timestamp`, `author`
- **Filters**: Agents filter by `project_id` to isolate context

### 3. The Tool Gateway (Secure Proxy)

**Purpose**: Execute tool operations on behalf of agents without exposing credentials.

**Responsibilities**:
- **Credential Storage**: Store encrypted third-party API keys (GitHub, AWS, etc.)
- **Intent Processing**: Receive tool requests from agents (e.g., `{tool: "github", action: "push"}`)
- **Secure Execution**: Execute operations with stored credentials
- **Audit Logging**: Log all tool executions for security

**Security Model**:
- Agents **never** receive raw API keys
- All credentials encrypted at rest
- Execution happens server-side only
- Per-workgroup credential scoping

### 4. The Agent Protocol (WebSocket Interface)

**Purpose**: Standardized communication protocol for agents to connect to the Nexus.

**Protocol Spec**:
- **Transport**: WebSocket (Socket.io)
- **Authentication**: JWT in handshake query params
- **Events**: Typed event system (Pydantic models)
- **Stateless**: Agents rebuild state from Slack thread + ClickUp on each wake
- **Tool Standard**: Model Context Protocol (MCP)

**Event Types**:
- `TASK_ASSIGNED`: New task from ClickUp
- `CONTEXT_UPDATE`: New message in Slack thread
- `WAKE_UP`: Generic agent wake signal
- `TOOL_RESULT`: Response from tool execution
- `HEARTBEAT`: Keep-alive ping/pong

---

## Data Flow

### Primary Flow: Task Creation → Agent Action

```
1. Human creates task in ClickUp with @AI_Squad mention
         ↓
2. ClickUp sends webhook to Nexus (POST /webhooks/clickup)
         ↓
3. Nexus enqueues webhook (BullMQ) → returns 200 OK
         ↓
4. Worker processes webhook, parses @mentions
         ↓
5. Nexus queries project_mappings: clickup_list_id → slack_channel_id
         ↓
6. Nexus posts "Root Message" in Slack channel via API
         ↓
7. Nexus stores thread_ts in task_mappings table
         ↓
8. Nexus sends TASK_ASSIGNED event to Agent via WebSocket
         ↓
9. Agent wakes up, fetches context from Memory Bank (Qdrant RAG)
         ↓
10. Agent processes task, posts updates to Slack thread
         ↓
11. Nexus detects Agent message, syncs to ClickUp as comment
         ↓
12. Task complete!
```

### Bidirectional Sync

#### Slack → ClickUp
```
Slack message (in thread) → Nexus detects → Posts as ClickUp comment
```

**Conditions**:
- Message must be in a tracked thread (`thread_ts` exists in `task_mappings`)
- Can filter by metadata or keywords (configurable)

#### ClickUp → Slack
```
ClickUp comment → Webhook to Nexus → Posts in Slack thread
```

**Conditions**:
- Comment on tracked task
- Notify agent of new context

---

## Data Model (Container System)

Oblivion enforces a strict hierarchy for context management:

### Level 1: Workgroup (Tenant)

**Definition**: Permanent engineering squad or department

**Mapping**:
- **Slack**: Dedicated channel (e.g., `#squad-backend`)
- **ClickUp**: Space or Folder
- **Oblivion**: `tenant_id` in database

**Capabilities**:
- Shared secrets scoped to workgroup
- Isolated resources (databases, agents)
- Team-level permissions

### Level 2: Project (Context Scope)

**Definition**: Temporary initiative with start/end date

**Mapping**:
- **Slack**: Dedicated channel (e.g., `#proj-auth-refactor`)
- **ClickUp**: Specific List
- **Lifecycle**: Created when List created, Archived when List marked complete

**Isolation**:
- Agents can **only** RAG search documents/chats linked to this project
- Project-specific context boundary

### Level 3: Task (Unit of Work)

**Definition**: Atomic unit that triggers an agent

**Mapping**:
- **Slack**: Thread inside Project Channel
- **ClickUp**: Unique `task_id`

**State Machine**:
```
TODO → IN_PROGRESS → BLOCKED_ON_HUMAN → DONE
```

**Thread Structure**:
- Root message: Posted by Nexus when task created
- Replies: Agent updates, human responses
- Metadata: Links back to ClickUp task

---

## Design Principles

### 1. Mirror, Don't Replace

**Philosophy**: Oblivion doesn't force users to adopt new tools. It works **within** existing workflows.

**Implementation**:
- Slack remains the source of truth for discussions
- ClickUp remains the source of truth for task state
- Oblivion keeps them synchronized

### 2. Agents as First-Class Team Members

**Philosophy**: Agents have persistent identity, access to context, and autonomy.

**Implementation**:
- Agents have stable IDs and names (appear as team members in Slack)
- Agents can search full project history via RAG
- Agents can autonomously execute tools (with security controls)

### 3. Security by Design

**Philosophy**: Zero-trust security model, agents operate with minimal privileges.

**Implementation**:
- Agents authenticate via OAuth 2.0 Client Credentials
- Tool execution proxied through Gateway (no direct credentials)
- All actions logged and auditable
- Workgroup-level isolation

### 4. Statelessness

**Philosophy**: Agents don't maintain local state; they rebuild from source of truth.

**Implementation**:
- On wake, agents read full Slack thread + ClickUp description
- Context retrieved from Qdrant (vector search)
- No local caching of sensitive data

### 5. Event-Driven Architecture

**Philosophy**: No polling, everything is push-based.

**Implementation**:
- Webhooks from external tools (ClickUp, Slack)
- WebSocket events to agents
- Redis queue for reliable processing
- Async/non-blocking everywhere

---

## Key Design Decisions

### Why NestJS for Backend?

- **Type Safety**: First-class TypeScript support
- **WebSocket Support**: Built-in Socket.io gateway
- **Modularity**: Clean separation of concerns
- **DI Container**: Excellent for testing and organization
- **Ecosystem**: Rich library ecosystem (BullMQ, Prisma, etc.)

### Why Python for Agents?

- **LangGraph**: Best-in-class agent orchestration framework
- **LLM Libraries**: Native ecosystem (LangChain, LlamaIndex)
- **MCP Support**: Model Context Protocol implementations
- **Community**: Large AI/ML community and tools

### Why Qdrant for Vector Store?

- **Performance**: Fast similarity search
- **Filtering**: Rich metadata filtering for project isolation
- **API**: Clean REST and gRPC APIs
- **Self-Hosted**: Can run in Kubernetes cluster
- **Scalability**: Handles millions of vectors

### Why Prisma ORM?

- **Type Safety**: Auto-generated types from schema
- **Migrations**: Declarative migration system
- **Relations**: Easy to model complex relationships
- **Async**: Native async/await support
- **Developer Experience**: Excellent tooling

### Why BullMQ for Queues?

- **Reliability**: Durable, Redis-backed queue
- **Performance**: High throughput, low latency
- **Features**: Delayed jobs, priority, retries
- **Monitoring**: Built-in UI and metrics
- **NestJS Integration**: Official `@nestjs/bullmq` package

---

## Integration Patterns

### ClickUp Integration

**Authentication**: OAuth 2.0 (user installs Oblivion app in ClickUp)

**Webhooks Handled**:
- `taskCreated`: New task assigned to agent
- `taskUpdated`: Task status changed
- `taskCommentPosted`: Human commented on task

**API Operations**:
- `POST /task/:taskId/comment`: Post agent updates back to ClickUp
- `GET /list/:listId/tasks`: Fetch tasks for mapping UI
- `PATCH /task/:taskId`: Update task status

### Slack Integration

**Authentication**: OAuth 2.0 (user installs Oblivion app in Slack workspace)

**Events Handled**:
- `message.channels`: New message in tracked channel
- `app_mention`: User mentions Oblivion bot
- `channel_created`: New channel (potential project)

**API Operations**:
- `POST /chat.postMessage`: Post agent messages to Slack
- `POST /chat.postEphemeral`: Send private messages to users
- `GET /conversations.history`: Fetch thread history for RAG ingestion

### Agent Integration

**Connection Flow**:
1. Agent authenticates with `client_id` + `client_secret`
2. Receives JWT access token
3. Connects to WebSocket with token in query params
4. Nexus validates JWT, stores `socket_id → agent_id` mapping in Redis
5. Agent registers capabilities and subscribes to events

**Event Loop**:
1. Agent waits for `TASK_ASSIGNED` or `CONTEXT_UPDATE` event
2. On event, rebuilds state from Slack thread + ClickUp description
3. Performs RAG search for relevant context
4. Executes LangGraph decision flow
5. Requests tool execution via Tool Gateway
6. Posts updates back to Slack via Nexus
7. Returns to waiting state

---

## Non-Functional Architecture

### Latency Requirements

- **Magic Moment**: Task Creation → Slack Notification < 3 seconds
- **RAG Search**: Vector similarity search < 500ms
- **Agent Wake**: Event dispatch < 100ms
- **Tool Execution**: Varies by tool (GitHub API, etc.)

### Scalability

- **WebSocket Gateway**: 10,000 concurrent agent connections per instance
- **Horizontal Scaling**: Nexus instances share state via Redis
- **Queue Processing**: Multiple workers process webhooks in parallel
- **Vector Search**: Qdrant scales independently

### Reliability

- **Webhook Processing**: Durable queue (Redis/BullMQ) ensures no events lost
- **Agent Reconnection**: Automatic reconnection with exponential backoff
- **Heartbeat**: 30s ping/pong to detect dead connections
- **Circuit Breaker**: Mute agents sending > 10 messages/min

---

## Security Architecture

### Authentication & Authorization

**Human Users**:
- OAuth 2.0 via ClickUp/Slack for workspace access
- Clerk/NextAuth for dashboard login
- Role-based access control (RBAC)

**AI Agents**:
- OAuth 2.0 Client Credentials flow
- JWT tokens for WebSocket authentication
- Agent-to-Workgroup assignment enforcement

### Credential Management

**External Secrets Operator**:
- All secrets stored in AWS Secrets Manager / HashiCorp Vault
- Kubernetes syncs via ExternalSecret resources
- No secrets in code or environment files

**Tool Gateway Security**:
- Third-party credentials (GitHub tokens, etc.) stored encrypted
- Agents request tool execution via intent objects
- Gateway executes with stored credentials
- Full audit trail of tool usage

### Network Security

**Pod-to-Pod**:
- Kubernetes NetworkPolicies restrict traffic
- TLS for database connections
- Redis authentication enabled

**External**:
- Kong Ingress with rate limiting
- TLS termination at ingress
- CORS configured per environment

---

## Data Architecture

### PostgreSQL Schema

**Core Tables** (from MASTER.md):
- `tenants`: Workgroups/Squads
- `agents`: Registered AI agents
- `project_mappings`: ClickUp List ↔ Slack Channel
- `task_mappings`: ClickUp Task ↔ Slack Thread
- `agent_aliases`: Agent mention patterns

**Relationships**:
- Tenant → Projects (1:N)
- Project → Tasks (1:N)
- Agent → Workgroups (N:M)

### Redis Usage

**Purpose**: Cache, Queue, and Real-time State

**Data Structures**:
- **Socket Map**: `socket:{socket_id} → agent_id`
- **Agent Status**: `agent:{agent_id} → {status, last_seen}`
- **BullMQ Queues**: `webhook-processing`, `rag-ingestion`
- **Rate Limiting**: Token bucket for API calls

### Qdrant Collections

**Structure**:
- **Collection per Workgroup**: `tenant_{tenant_id}`
- **Points**: Embedded Slack messages and documents
- **Metadata**: `project_id`, `task_id`, `thread_ts`, `author`, `timestamp`
- **Filtering**: Agents filter by `project_id` for isolation

---

## Deployment Architecture

### Kubernetes Components

**Nexus Deployment**:
- Multiple replicas (3+ in production)
- Horizontal Pod Autoscaler (HPA)
- Resource limits: CPU, memory
- Liveness/readiness probes

**Observer Deployment**:
- Multiple replicas (2+ in production)
- CDN for static assets (if applicable)
- Server-side rendering (SSR)

**Infrastructure**:
- PostgreSQL (Bitnami Helm chart)
- Redis (Bitnami Helm chart)
- Qdrant (Official Helm chart)
- Langfuse (Self-hosted chart for LLM tracing)

**Ingress**:
- Kong API Gateway
- Routes: `/api/*` → Nexus, `/` → Observer
- Rate limiting, authentication plugins

### Helm Chart Structure

```
infra/helm/
└── oblivion/               # Umbrella chart
    ├── Chart.yaml
    ├── values.yaml
    ├── values-dev.yaml
    ├── values-staging.yaml
    ├── values-prod.yaml
    └── charts/
        ├── nexus/          # NestJS backend subchart
        ├── observer/       # Next.js frontend subchart
        ├── postgresql/     # Database subchart
        ├── redis/          # Cache/Queue subchart
        ├── qdrant/         # Vector store subchart
        └── langfuse/       # LLM tracing subchart
```

---

## Development Architecture

### Local Development

**Approach**: Kubernetes-native development with Kind

**Setup**:
1. Kind cluster on laptop
2. All services deployed via Helm
3. Telepresence for hybrid local/k8s development
4. Port forwarding for service access

**Workflow**:
- Develop NestJS backend locally with `npm run start:dev`
- Use Telepresence to intercept traffic from K8s cluster
- Test against real PostgreSQL/Redis/Qdrant in cluster
- Deploy to cluster for integration testing

---

## Architectural Trade-offs

### WebSockets vs HTTP Polling

**Decision**: WebSockets

**Rationale**:
- Lower latency for agent wake-up (< 100ms vs seconds)
- Reduced server load (no constant polling)
- Better for real-time collaboration

**Trade-offs**:
- More complex state management (Redis for multi-pod)
- Connection resilience required (auto-reconnect)

### Monorepo vs Polyrepo

**Decision**: Monorepo (`apps/`, `packages/`, `infra/`)

**Rationale**:
- Shared TypeScript types between Nexus and Observer
- Coordinated deployments via umbrella Helm chart
- Easier local development (single git clone)

**Trade-offs**:
- Larger repository size
- CI/CD must be path-specific (only build changed apps)

### Prisma vs Drizzle

**Decision**: Prisma

**Rationale**:
- Superior TypeScript integration and type generation
- Declarative migration system
- Excellent NestJS integration
- Better tooling (Prisma Studio)

**Trade-offs**:
- Slightly heavier runtime overhead
- Less control over raw SQL

### PostgreSQL vs NoSQL

**Decision**: PostgreSQL

**Rationale**:
- Relational data (tenants, agents, mappings)
- ACID transactions for critical operations
- Strong consistency for task state
- Rich query capabilities

**Trade-offs**:
- Qdrant handles unstructured data (chat history)
- Hybrid approach (SQL + Vector DB)

---

## Future Architecture Considerations

### Horizontal Scaling

**Current**: 3-5 Nexus pods with shared state via Redis

**Future**:
- Sharding by Tenant ID for massive scale
- Separate WebSocket Gateway cluster
- CDN for Observer static assets

### Multi-Region

**Current**: Single region deployment

**Future**:
- Multi-region PostgreSQL (read replicas)
- Qdrant distributed cluster
- Global load balancing

### Agent Diversity

**Current**: Python LangGraph agents

**Future**:
- Support for TypeScript agents (Vercel AI SDK)
- Support for Go agents
- Agent marketplace for pre-built agents

---

*This architecture evolves with the product. See [self-improvement.md](./self-improvement.md) for proposing architectural improvements.*

**Last Updated**: 2026-01-02
**Reference**: [`product/PRD.md`](../product/PRD.md) Section 2
