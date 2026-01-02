# 📜 MASTER PRD: Project Oblivion

---

## 1. Executive Summary

**Oblivion** is the "Connective Tissue" for the Autonomous Workforce. It is an orchestration platform that enables AI Agents to work alongside humans within existing toolchains—specifically **Slack** (Communication) and **ClickUp** (Task Management)—without requiring humans to adopt new interfaces.

### 1.1 The Vision
To transform AI Agents from "chatbots in a browser" into **First-Class Team Members**. An Agent in Oblivion has a persistent identity, access to team context (history), and the ability to autonomously drive tasks to completion using secure tools.

### 1.2 The "Mirror" Philosophy
Oblivion does not replace your tools; it mirrors state between them.
- **Action Source:** ClickUp (Tasks).
- **Discussion Source:** Slack (Context).
- **Execution Layer:** Oblivion (Agents).

When a task updates in ClickUp, Oblivion wakes the relevant Agent. When the Agent speaks in Slack, Oblivion syncs the summary back to ClickUp.

---

## 2. Core Architecture

The platform operates on a **Hub-and-Spoke** model.

### 2.1 High-Level Components
1.  **The Nexus (Backend):** A Node.js (NestJS) gateway that acts as the router. It ingests Webhooks from Slack/ClickUp and routes them to Agents via WebSockets.
2.  **The Memory Bank (Vector Store):** A Qdrant cluster that ingests chat history and documentation, allowing Agents to perform RAG (Retrieval Augmented Generation) to understand project context.
3.  **The Tool Gateway:** A secure proxy server. Agents request tool execution (e.g., "Push to GitHub"), and the Gateway executes it using encrypted, stored credentials.
4.  **The Agent Protocol:** A standardized WebSocket interface that allows *any* Python/LangGraph agent to connect to the Nexus.

### 2.2 Data Flow Description
1.  **Trigger:** Human creates a task in ClickUp.
2.  **Ingress:** ClickUp sends a Webhook to Oblivion Nexus.
3.  **Routing:** Nexus looks up the Project Mapping (Postgres) to find the corresponding Slack Channel.
4.  **Dispatch:** Nexus sends a WebSocket event to the assigned Agent.
5.  **Action:** Agent connects to the Slack Channel via the Nexus Proxy and posts a reply.
6.  **Feedback:** Nexus detects the Agent's Slack message and mirrors it back to the ClickUp task as a comment.

---

## 3. Hierarchy & Data Model (The "Container" System)

To manage complexity, we enforce a strict hierarchy of context.

### 3.1 Level 1: The Workgroup (Tenant)
- **Definition:** Represents a permanent engineering squad or department.
- **Mapping:**
    - **Slack:** A dedicated channel `#squad-backend` (Permanent).
    - **ClickUp:** A specific `Space` or `Folder`.
    - **Oblivion:** `TenantID`.
- **Capabilities:** Shared secrets (e.g., AWS Keys) are scoped to the Workgroup.

### 3.2 Level 2: The Project (Context Scope)
- **Definition:** A temporary initiative with a start and end date.
- **Mapping:**
    - **Slack:** A dedicated channel `#proj-auth-refactor` (Ephemeral).
    - **ClickUp:** A specific `List`.
    - **Lifecycle:**
        - **Created:** When ClickUp List is created.
        - **Archived:** When ClickUp List is marked "Complete".
- **Isolation:** Agents in this project can *only* RAG search documents/chats linked to this project.

### 3.3 Level 3: The Task (Unit of Work)
- **Definition:** The atomic unit that triggers an Agent.
- **Mapping:**
    - **Slack:** A **Thread** inside the Project Channel.
    - **ClickUp:** A unique `TaskID`.
- **State Machine:** `TODO` -> `IN_PROGRESS` -> `BLOCKED_ON_HUMAN` -> `DONE`.

---

## 4. Functional Requirements

### 4.1 Authentication & Security
- **FR-001 (Agent Auth):** Agents must authenticate via OAuth 2.0 Client Credentials flow (`client_id`, `client_secret`).
- **FR-002 (Secret Injection):** Agents must never receive raw third-party API keys (e.g., GitHub Tokens). They must send intent objects `{ tool: "github", action: "push" }` which the Gateway executes.
- **FR-003 (Role Based Access):** Humans can assign/revoke Agents from Projects via the Oblivion Dashboard.

### 4.2 Integration Logic (The "Mirror")
- **FR-004 (Task Creation Trigger):**
    - **Input:** ClickUp Webhook (`taskCreated`).
    - **Process:** Parse description for `@mentions` (e.g., `@AI_Squad`).
    - **Output:** Post a "Root Message" in the mapped Slack Project Channel.
- **FR-005 (Bi-Directional Sync):**
    - **Slack -> ClickUp:** If an Agent posts a message in Slack with `metadata: { type: "FINAL_REPORT" }`, Oblivion must post that content as a Comment on the ClickUp task.
    - **ClickUp -> Slack:** If a Human comments on the ClickUp task, Oblivion must post it into the Slack Thread to notify the Agent.

### 4.3 The "Subvocal" Protocol (UX)
- **FR-006 (Thought Separation):** Agents must support two output streams:
    1.  **Public:** User-facing status updates (Markdown).
    2.  **Private:** Internal chain-of-thought logs (JSON).
- **FR-007 (UI Rendering):** The Slack integration must use Block Kit to render "Private" thoughts as collapsed/hidden accordions or strictly in a separate "Debug Thread".

### 4.4 Memory & RAG
- **FR-008 (Ingestion):** Every Slack message in a Project Channel is embedded and stored in Qdrant asynchronously (max delay 5s).
- **FR-009 (Summarization):** A background job runs every 50 messages to generate a comprehensive summary of the thread, stored in Postgres for quick retrieval.

---

## 5. Agent Interface Standard (AIS)

Agents connecting to Oblivion must adhere to the following behavioral contract:

1.  **Statelessness:** Agents must not store local state. They must rebuild state from the Slack Thread + ClickUp Description upon waking up.
2.  **Event-Driven:** Agents do not poll. They must expose a Webhook/WebSocket endpoint to receive `WAKE_UP` events.
3.  **Tool Usage:** Agents must use the **Model Context Protocol (MCP)** standard for tool definitions.

---

## 6. Non-Functional Requirements

- **NFR-001 (Latency):** "Magic Moment" latency (Task Creation -> Slack Notification) must be < 3 seconds.
- **NFR-002 (Scalability):** The WebSocket Gateway must support 10,000 concurrent agent connections per instance.
- **NFR-003 (Reliability):** Webhook processing must use a durable queue (Redis/BullMQ) to ensure no Slack/ClickUp events are lost during downtime.