# Oblivion Development Roadmap

**Last Updated:** 2026-01-17

This document outlines features that are documented but not yet implemented, as well as future enhancements planned for the Oblivion platform.

---

## Current Status

**What's Working Today:**
- ✅ Core orchestration (Nexus backend with WebSocket gateway)
- ✅ Task routing via @tags from ClickUp
- ✅ Agent authentication and approval workflow
- ✅ Groups & Projects hierarchy
- ✅ Observer dashboard (full UI)
- ✅ Python SDK for agent development
- ✅ ClickUp integration (webhooks, @tag parsing, comments)
- ✅ Slack integration (posting messages, channel creation)
- ✅ Task claiming and status tracking
- ✅ Real-time agent status monitoring

**What's Partially Working:**
- ⚠️ Slack integration (can send, cannot receive messages)
- ⚠️ Kubernetes deployment (infrastructure only, no app manifests)

**What's Not Yet Implemented:**
- ❌ Memory Bank / RAG system
- ❌ Tool Gateway (conflicting documentation)
- ❌ Slack event processing (message ingestion)
- ❌ Langfuse LLM tracing integration
- ❌ Subvocal protocol (thought separation)
- ❌ Auto-summarization of threads

---

## Phase 1: Complete Core Platform (Priority: High)

### 1.1 Slack Message Ingestion
**Status:** 🔴 Critical Gap

**Description:** Implement Slack event processing to enable bidirectional sync.

**Tasks:**
- [ ] Implement `message.channels` event handler in webhook processor
- [ ] Parse and route Slack messages to agents
- [ ] Sync agent messages from Slack → ClickUp as comments
- [ ] Filter messages based on thread context
- [ ] Handle @mentions and direct messages

**Why Critical:** Without this, agents can't receive human feedback in Slack threads.

**PRD Reference:** FR-006 (Bi-Directional Sync)

---

### 1.2 Kubernetes Application Deployment
**Status:** 🔴 Critical Gap

**Description:** Add Helm templates for deploying Nexus and Observer to Kubernetes.

**Tasks:**
- [ ] Create `templates/nexus-deployment.yaml`
- [ ] Create `templates/nexus-service.yaml`
- [ ] Create `templates/observer-deployment.yaml`
- [ ] Create `templates/observer-service.yaml`
- [ ] Create `templates/ingress.yaml` (Kong configuration)
- [ ] Add ConfigMaps for environment variables
- [ ] Add Secrets management (External Secrets Operator)
- [ ] Configure liveness/readiness probes
- [ ] Set up Horizontal Pod Autoscaler (HPA)

**Why Critical:** Cannot deploy to production without these manifests.

**Architecture Reference:** Deployment Architecture section

---

### 1.3 Tool Execution Strategy (Clarify & Implement)
**Status:** 🟡 Design Decision Required

**Description:** Resolve the conflict between PRD (local execution) and architecture.md (centralized gateway).

**Decision Options:**

**Option A: Local Tool Execution (as per PRD FR-002)**
- Agents run tools in their own runtime environment
- Credentials injected via Kubernetes secrets
- Nexus is just a router, not a credential manager
- **Pros:** Simpler, less security risk for platform, decentralized
- **Cons:** Each agent needs credential management

**Option B: Centralized Tool Gateway**
- Nexus stores and manages all tool credentials
- Agents request tool execution via WebSocket
- Nexus executes and returns results
- **Pros:** Centralized audit trail, easier credential rotation
- **Cons:** Single point of failure, increased platform complexity

**Tasks:**
- [ ] Make architectural decision: Local vs Centralized
- [ ] Update PRD OR architecture.md to match decision
- [ ] Implement chosen approach
- [ ] Update Python SDK to support chosen pattern
- [ ] Document credential injection process

**Why Important:** Agents need to execute tools (GitHub, AWS, etc.) to complete tasks.

---

## Phase 2: Memory & Context (Priority: Medium)

### 2.1 Memory Bank / RAG System
**Status:** 🟡 Infrastructure Ready, Code Missing

**Description:** Implement vector-based RAG for agent context retrieval.

**Tasks:**
- [ ] Create Qdrant service wrapper in Nexus
- [ ] Implement embedding generation (OpenAI or self-hosted)
- [ ] Build message ingestion pipeline (Slack → Qdrant)
- [ ] Wire up `rag-ingestion` queue processor
- [ ] Create RAG search endpoints for agents
- [ ] Implement project-scoped filtering
- [ ] Add collection management (one per tenant)
- [ ] Test semantic search accuracy

**Dependencies:**
- Qdrant is already in Helm dependencies ✅
- `rag-ingestion` queue exists ✅
- Need to implement worker processors

**PRD Reference:** FR-010 (Paged Memory), FR-011 (Auto-Summarization)

**Architecture Reference:** The Memory Bank section

---

### 2.2 Auto-Summarization
**Status:** 🔴 Not Started

**Description:** Automatically summarize Slack threads to prevent context overflow.

**Tasks:**
- [ ] Create background job to detect 50+ message threads
- [ ] Integrate LLM for summarization (OpenAI or self-hosted)
- [ ] Store summaries in PostgreSQL and/or Qdrant
- [ ] Provide summary API for agents
- [ ] Update Python SDK to fetch summaries
- [ ] Configure summarization frequency (every 50 messages)

**PRD Reference:** FR-011

---

## Phase 3: Observability & Debugging (Priority: Medium)

### 3.1 Langfuse LLM Tracing
**Status:** 🔴 Not Integrated

**Description:** Track all LLM calls for cost and quality auditing.

**Tasks:**
- [ ] Add Langfuse to Helm chart dependencies
- [ ] Integrate Langfuse SDK in Nexus
- [ ] Trace agent LLM calls via WebSocket events
- [ ] Create dashboard views for LLM metrics
- [ ] Track costs per agent/task/project
- [ ] Alert on anomalous LLM usage

**PRD Reference:** NFR-003 (Observability)

---

### 3.2 Subvocal Protocol (Thought Separation)
**Status:** 🔴 Not Started

**Description:** Separate agent "thinking" from user-facing output.

**Tasks:**
- [ ] Define event types: `PUBLIC_MESSAGE` vs `PRIVATE_THOUGHT`
- [ ] Update Python SDK to support dual streams
- [ ] Implement Slack Block Kit accordions for private thoughts
- [ ] Create debug thread option in Slack
- [ ] Add thought toggle in Observer UI
- [ ] Store thoughts for replay/debugging

**PRD Reference:** FR-008 (Thought Separation), FR-009 (UI Rendering)

---

## Phase 4: Scale & Production Hardening (Priority: Low)

### 4.1 Multi-Region Support
**Status:** 🔴 Future Enhancement

**Tasks:**
- [ ] PostgreSQL read replicas
- [ ] Qdrant distributed cluster
- [ ] Redis Sentinel for HA
- [ ] Global load balancing
- [ ] Region-specific WebSocket gateways

---

### 4.2 Agent Diversity
**Status:** 🔴 Future Enhancement

**Description:** Support agents in languages other than Python.

**Tasks:**
- [ ] TypeScript SDK (Vercel AI SDK integration)
- [ ] Go SDK
- [ ] Agent marketplace for pre-built agents
- [ ] Containerized agent templates

---

### 4.3 Advanced Security
**Status:** 🔴 Future Enhancement

**Tasks:**
- [ ] Implement External Secrets Operator
- [ ] Add audit logging for all agent actions
- [ ] Role-based access control (RBAC) for humans
- [ ] Agent permission scopes (what tools can each agent use)
- [ ] Network policies for pod-to-pod communication
- [ ] Secrets rotation automation

---

## Phase 5: UX Enhancements (Priority: Low)

### 5.1 Human-in-the-Loop Workflows
**Status:** 🔴 Future Enhancement

**Tasks:**
- [ ] Approval gates for critical agent actions
- [ ] Human review interface in Observer
- [ ] Slack approval buttons
- [ ] Agent pause/resume controls

---

### 5.2 Agent Analytics
**Status:** 🔴 Future Enhancement

**Tasks:**
- [ ] Task completion rate per agent
- [ ] Average task duration
- [ ] Agent collaboration metrics
- [ ] Cost per task (LLM + infrastructure)
- [ ] Quality scoring system

---

## Decision Points

### Pending Architectural Decisions

1. **Tool Execution Model**
   - **Question:** Local execution (PRD) or centralized gateway (architecture.md)?
   - **Impact:** Affects agent design, security model, platform complexity
   - **Deadline:** Before Phase 1.3

2. **RAG Strategy**
   - **Question:** OpenAI embeddings or self-hosted model?
   - **Impact:** Cost, latency, data privacy
   - **Deadline:** Before Phase 2.1

3. **Deployment Platform**
   - **Question:** Self-hosted K8s or managed service (EKS, GKE, AKS)?
   - **Impact:** Operations burden, cost, reliability
   - **Deadline:** Before Phase 1.2

---

## Completed Milestones

- ✅ **Phase 0.1 (Dec 2025):** Basic NestJS backend with Prisma
- ✅ **Phase 0.2 (Dec 2025):** WebSocket gateway with JWT auth
- ✅ **Phase 0.3 (Jan 2026):** ClickUp integration with @tag routing
- ✅ **Phase 0.4 (Jan 2026):** Groups & Projects hierarchy
- ✅ **Phase 0.5 (Jan 2026):** Observer dashboard (full UI)
- ✅ **Phase 0.6 (Jan 2026):** Python SDK with examples
- ✅ **Phase 0.7 (Jan 2026):** Task claiming workflow
- ✅ **Phase 0.8 (Jan 2026):** Agent registration tokens

---

## Contributing

If you're implementing a feature from this roadmap:
1. Check the PRD (`product/PRD.md`) for functional requirements
2. Review the architecture (`ALIGNMENT_REPORT.md`, `architecture.md`)
3. Update this roadmap when you start and complete work
4. Update the alignment report when implementation is done

---

**Next Review:** 2026-02-01
