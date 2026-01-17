# 📜 MASTER PRD: Project Oblivion

| Metadata | Details |
| :--- | :--- |
| **Version** | 1.2.0 (UPDATED) |
| **Status** | 🟢 Live |
| **Last Updated** | 2026-01-17 |
| **Target Audience** | Engineering, Product, Design |
| **Repository** | `oblivion-core` |

---

## 1. Executive Summary

**Oblivion** is the "Connective Tissue" for the Autonomous Workforce. It is a Kubernetes-native orchestration platform that enables AI Agents to work alongside humans within existing toolchains—specifically **Slack** (Communication) and **ClickUp** (Task Management)—without requiring humans to adopt new interfaces.

### 1.1 The Vision
To transform AI Agents from "chatbots in a browser" into **First-Class Team Members**. An Agent in Oblivion has a persistent identity, access to team context (history), and the ability to autonomously drive tasks to completion using decentralized, secure tools.

### 1.2 The "Mirror" Philosophy
Oblivion does not replace your tools; it mirrors state between them.
- **Action Source:** ClickUp (Tasks).
- **Discussion Source:** Slack (Context).
- **Execution Layer:** Oblivion (Agents).

When a task updates in ClickUp, Oblivion wakes the relevant Agent. When the Agent speaks in Slack, Oblivion syncs the summary back to ClickUp.

### 1.3 What Nexus is NOT

To maintain focus and avoid scope creep, Nexus explicitly does **not** attempt to:

| ❌ Nexus Does NOT | ✅ Instead |
|:---|:---|
| Replace task managers (ClickUp, Jira, Linear) | Integrates with them as the source of truth |
| Store task content long-term | Syncs minimal metadata for routing/coordination |
| Provide a UI for humans to manage tasks | Humans use their existing PM tools |
| Compete with Slack for communication | Uses Slack as the human-agent communication channel |
| Execute tools on behalf of agents | Agents run tools locally with their own credentials |

**Nexus's value is in the orchestration layer:**
1. **Routing** - Get the right task to the right agent
2. **Communication Bridge** - Connect humans (Slack) with agents working on tasks
3. **Observability** - Dashboard to monitor agent activity and task progress
4. **Coordination** - Prevent conflicts (e.g., two agents claiming the same task)

---

## 2. Core Architecture

The platform operates on a **Distributed Hub-and-Spoke** model, designed for Kubernetes.

### 2.1 High-Level Components
1.  **The Nexus (Backend):** A Node.js (NestJS) gateway that acts as the router. It ingests Webhooks from Slack/ClickUp and routes them to Agents via WebSockets.
2.  **The Memory Engine (Vector Store):** A Qdrant cluster managed by a custom "Paged Memory" logic. It separates **Short-Term Context** (active thread) from **Long-Term Archives** (vectorized history), allowing agents to "remember" infinitely without context overflow.
3.  **The Agent Runtime (Worker):** Agents run as isolated Pods (or external processes). They execute tools **locally** using secrets injected directly into their environment (e.g., `GITHUB_TOKEN`), ensuring the platform is not a single point of failure for credentials.
4.  **The Agent Protocol:** A standardized WebSocket interface that allows *any* Python/LangGraph agent to connect, receive work, and stream "Thoughts" back to the Nexus.

### 2.2 Data Flow Description
1.  **Trigger:** Human creates a task in ClickUp with `@project-tag` in description.
2.  **Ingress:** ClickUp sends a Webhook to Oblivion Nexus.
3.  **Routing:** Nexus parses the `@tag` → finds Project → finds Group → identifies member Agents.
4.  **Notification:** Nexus posts task to Project's Slack channel and broadcasts `TASK_AVAILABLE` to Group members.
5.  **Claiming:** An Agent **claims** the task (first-come-first-served or by priority/capability matching).
6.  **Execution:** Agent works on task, posts updates to Slack thread, collaborates with other agents if needed.
7.  **Feedback:** Nexus detects Agent's Slack message and mirrors it back to the ClickUp task as a comment.

---

## 3. Hierarchy & Data Model (The "Container" System)

To manage complexity, we enforce a strict hierarchy of context.

### 3.1 Level 0: The Tenant (Organization)
- **Definition:** The top-level organization or company.
- **Mapping:**
    - **Oblivion:** `TenantID`.
- **Capabilities:** Infrastructure secrets (e.g., AWS Keys) are scoped here via Kubernetes Secrets.

### 3.2 Level 1: The Group (Agent Team)
- **Definition:** A permanent team of AI Agents with shared capabilities.
- **Examples:** "Backend Squad", "QA Team", "DevOps Agents"
- **Mapping:**
    - **Slack:** A dedicated channel `#oblivion-backend-squad` (Permanent, auto-created).
    - **Oblivion:** `GroupID`.
- **Characteristics:**
    - Agents **join and leave** groups dynamically.
    - One agent can belong to **multiple groups**.
    - Group channel used for **team-wide announcements** and **agent-to-agent communication**.
    - Agents in the same group can collaborate on tasks.

### 3.3 Level 2: The Project (Work Scope)
- **Definition:** A focused initiative within a Group.
- **Examples:** "Auth Refactor", "API v2", "Mobile App"
- **Mapping:**
    - **Slack:** A dedicated channel `#oblivion-auth-refactor` (Auto-created when project created).
    - **ClickUp:** An `@tag` (e.g., `@auth-refactor`) used in task descriptions.
    - **Oblivion:** `ProjectID` with `oblivion_tag` field.
- **Characteristics:**
    - Projects **belong to exactly one Group**.
    - All agents in the Group can see/claim tasks in the project.
    - Project channel used for **task discussions** and **work updates**.
- **Isolation:** Agents can *only* RAG search documents/chats linked to this project.

### 3.4 Level 3: The Task (Unit of Work)
- **Definition:** The atomic unit of work that Agents claim and execute.
- **Mapping:**
    - **Slack:** A **Thread** inside the Project Channel.
    - **ClickUp:** A unique `TaskID` with `@project-tag` in description.
- **Routing:** Tasks are routed by parsing `@tags` in ClickUp task descriptions.
- **Claiming:** Tasks are **not auto-assigned**. Agents **claim** tasks they want to work on.
- **Priority:** ClickUp priority determines order when an Agent is in multiple groups.
- **State Machine:** `TODO` -> `CLAIMED` -> `IN_PROGRESS` -> `BLOCKED_ON_HUMAN` -> `DONE`.

### 3.5 Visual Hierarchy

```
┌─────────────────────────────────────────────────────────────────────┐
│                           TENANT                                     │
│  (Organization)                                                      │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                         GROUP                                  │  │
│  │  "Backend Squad"                                              │  │
│  │  Slack: #oblivion-backend-squad                               │  │
│  │                                                               │  │
│  │  MEMBERS:                                                     │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐                       │  │
│  │  │ Agent A │  │ Agent B │  │ Agent C │                       │  │
│  │  └─────────┘  └─────────┘  └─────────┘                       │  │
│  │                                                               │  │
│  │  PROJECTS:                                                    │  │
│  │  ┌─────────────────────────────────────────────────────┐     │  │
│  │  │ Project: "Auth Refactor"                             │     │  │
│  │  │ Slack: #oblivion-auth-refactor                       │     │  │
│  │  │ ClickUp Tag: @auth-refactor                          │     │  │
│  │  │                                                      │     │  │
│  │  │ TASKS:                                               │     │  │
│  │  │ ├── Task #1 (Claimed by Agent A) ──► Slack Thread   │     │  │
│  │  │ ├── Task #2 (Unclaimed) ──► Slack Thread            │     │  │
│  │  │ └── Task #3 (Claimed by Agent B) ──► Slack Thread   │     │  │
│  │  └─────────────────────────────────────────────────────┘     │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Functional Requirements

### 4.1 Authentication & Security
- **FR-001 (Agent Auth):** Agents must authenticate via OAuth 2.0 Client Credentials flow (`client_id`, `client_secret`) to join the Nexus network.
    - **Registration:** Agents register using group-scoped registration tokens (self-service onboarding)
    - **Approval:** New agents enter `PENDING` state; admins approve/reject via Observer dashboard
    - **Status Flow:** `PENDING` → `APPROVED`/`REJECTED`
- **FR-002 (Decentralized Secrets):** The Platform (Nexus) does **not** execute tools on behalf of agents.
    - *Mechanism:* Agents must have their own tool credentials (e.g., `GITHUB_TOKEN`) injected into their runtime environment (Kubernetes Secrets or Env Vars).
    - *Why:* This ensures the Nexus is a "Router," not a "Super Admin" with keys to everything.
- **FR-003 (Role Based Access):** Humans can assign/revoke Agents from Groups via the Oblivion Dashboard.
    - **Group Membership:** Agents join/leave groups; membership includes role (`member`/`lead`)
    - **Project Access:** Agents in a Group can see/claim tasks from all Projects under that Group

### 4.2 Integration Logic (The "Mirror")
- **FR-004 (Task Creation Trigger):**
    - **Input:** ClickUp Webhook (`taskCreated`).
    - **Process:** Parse description for `@project-tag` or `@group-tag` (e.g., `@auth-refactor`, `@backend-squad`).
    - **Routing:** Tag → Project → Group → Slack Channel.
    - **Output:** Post a "Root Message" in the Project's Slack Channel.
- **FR-005 (Task Claiming):**
    - **Broadcast:** When task is posted, all agents in the Group receive `TASK_AVAILABLE` event.
    - **Claim:** First agent to respond with `CLAIM_TASK` owns it.
    - **Priority:** If agent is in multiple groups, ClickUp priority determines task order.
    - **Conflict Resolution:** If two agents claim simultaneously, Nexus arbitrates (first received wins).
- **FR-006 (Bi-Directional Sync):** ⚠️
    - **ClickUp -> Slack:** ✅ Working - Task comments post to Slack threads
    - **Slack -> ClickUp:** 🔮 Planned - Slack event processing not yet implemented (can send, can't receive)
- **FR-007 (Agent Communication):**
    - **Group Channel:** Agents post team-wide updates, can @mention other agents for help.
    - **Project Channel:** Task-specific discussions happen in threads.
    - **Collaboration:** Agents can request assistance from other Group members via the Group channel.

### 4.3 The "Subvocal" Protocol (UX) 🔮
> **Status:** 🔮 Planned - Not yet implemented

- **FR-008 (Thought Separation):** Agents must support two output streams:
    1.  **Public:** User-facing status updates (Markdown).
    2.  **Private:** Internal chain-of-thought logs (JSON) sent to **Langfuse** (for tracing) and the **Nexus Debug Stream** (for the Dashboard).
- **FR-009 (UI Rendering):** The Slack integration must use Block Kit to render "Private" thoughts as collapsed/hidden accordions or strictly in a separate "Debug Thread".

### 4.4 Memory & RAG 🔮
> **Status:** 🔮 Planned - Infrastructure ready (Qdrant in Helm chart), code not implemented

- **FR-010 (Paged Memory):** The system must implement a "Tiered Memory" strategy:
    - **Tier 1 (Context):** The immediate Slack Thread (Raw text).
    - **Tier 2 (Vector):** Qdrant storage for semantic search of *past* threads and docs.
- **FR-011 (Auto-Summarization):** A background job runs every 50 messages to generate a comprehensive summary of the thread, stored in Postgres/Qdrant to prevent context window overflow.

### 4.5 Group & Project Management
- **FR-012 (Group Creation):**
    - When a Group is created in Observer, Nexus **auto-creates** the corresponding Slack channel.
    - Channel naming convention: `#oblivion-{group-slug}`.
- **FR-013 (Project Creation):**
    - When a Project is created under a Group, Nexus **auto-creates** the corresponding Slack channel.
    - Channel naming convention: `#oblivion-{project-slug}`.
    - Project must have a unique `oblivion_tag` for ClickUp routing.
- **FR-014 (Agent Membership):**
    - Agents can join/leave Groups via Observer UI or API.
    - When an Agent joins a Group, they're automatically added to the Group's Slack channel.
    - Agents in a Group can see all Projects under that Group.

---

## 5. Agent Interface Standard (AIS)

Agents connecting to Oblivion must adhere to the following behavioral contract:

1.  **Statelessness:** Agents must not store local state on disk. They must rebuild state from the Slack Thread + ClickUp Description upon waking up.
2.  **Event-Driven:** Agents do not poll. They must expose a Webhook/WebSocket endpoint to receive `WAKE_UP` events.
3.  **Tool Usage:** Agents must use the **Model Context Protocol (MCP)** standard for tool definitions.

---

## 6. Non-Functional Requirements

- **NFR-001 (Latency):** ✅ "Magic Moment" latency (Task Creation -> Slack Notification) must be < 3 seconds.
- **NFR-002 (Scalability):** ✅ The WebSocket Gateway must support horizontal scaling (Redis Adapter) to handle 10,000+ concurrent connections.
- **NFR-003 (Observability):** 🔮 All Agent "Thoughts" and LLM calls must be traced in **Langfuse** for cost and quality auditing. (Planned - not integrated)
- **NFR-004 (Reliability):** ✅ Webhook processing must use a durable queue (Redis/BullMQ) to ensure no Slack/ClickUp events are lost during downtime.
