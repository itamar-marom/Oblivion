# ⚙️ PRODUCT SPEC: Backend Capabilities & Architecture

| Metadata | Details |
| :--- | :--- |
| **Document Owner** | Product Management |
| **Scope** | Core Platform Logic (The Nexus) |
| **Status** | 🟢 Approved for Architecture |
| **Version** | 1.1.0 (UPDATED) |

---

## 1. Executive Summary
The Backend (internally codenamed "The Nexus") is the central nervous system of Oblivion. It does not store tasks (ClickUp does that) and it does not host chat (Slack does that).

**Its primary mandate is Traffic Control:** It ingests noisy signals from external tools, normalizes them, enriches them with context, and routes them to the correct AI Agents. It is designed to be **Stateless** and **Kubernetes-Native**.

---

## 2. Core Capabilities

### 2.1 The Ingestion Engine ("The Ears")
The system must be able to listen to the outside world without failing, even during traffic spikes.

* **Webhook Normalization:** The system must accept payloads from **ClickUp**, **Slack**, and **GitHub**. It must convert these disparate JSON formats into a single internal `StandardEvent` format.
    * *Example:* A ClickUp `taskCreated` event and a GitHub `issue_opened` event should both look like `NewWorkItem` to the internal router.
* **Durable Buffering:** If the Agent Swarm is offline or overloaded, incoming webhooks must not be lost. They must be queued (buffered in Redis/BullMQ) and replayed when capacity is available.

### 2.2 The Identity Resolver ("The Rolodex")
The system acts as the source of truth for "Who is who."

* **Alias Resolution:** The backend must resolve abstract tags into concrete Agent IDs.
    * Input: `@AI_Squad` (from ClickUp).
    * Output: `["agent_uuid_1", "agent_uuid_2"]`.
* **Auth Provider:** The backend issues **OAuth2 Tokens** to Agents. It validates these tokens on every WebSocket connection to ensure rogue scripts cannot join the network.

### 2.3 The Context Engine ("The Librarian")
Agents are stateless. The Backend provides them with memory on demand using a **"Paged Memory"** architecture.

* **Tiered Retrieval:**
    * **Short-Term:** The Backend provides the immediate Slack Thread history.
    * **Long-Term:** The Backend exposes a Vector Search API (Qdrant) allowing agents to query past decisions and project documentation.
* **Auto-Summarization:**
    * The Backend must periodically scan active Slack threads. If a thread exceeds 50 messages, it triggers a background job to summarize the discussion and store it as a permanent record in Qdrant, preventing context window overflow.

---

## 3. Security & Decentralization
We have moved away from a centralized "Proxy Execution" model to a **Decentralized Secret Model**.

### 3.1 Agent Autonomy
* **No Central Key Storage:** The Backend does **not** store or proxy third-party tool keys (e.g., `GITHUB_TOKEN`).
* **Identity Validation:** The Backend's role is to validate the *Agent's* identity (via OAuth). Once validated, the Agent is trusted to execute tools locally using secrets injected directly into its Kubernetes Pod.

### 3.2 The "Kill Switch"
The Admin Dashboard needs a master override.
* **Capability:** The Backend must support an immediate `STOP_ALL_AGENTS` command that:
    1.  Severs all WebSocket connections immediately.
    2.  Pauses all outgoing Webhooks to Slack/ClickUp (stopping the "Mirror").
    3.  (Optional) Triggers a Kubernetes event to scale down Agent deployments to zero.

---

## 4. Governance & Observability

### 4.1 The Circuit Breaker
To prevent "Runaway AI" (e.g., an agent trapped in a loop creating infinite comments).

* **Rate Limiting:**
    * **Per Agent:** Max 10 messages/minute.
    * **Per Project:** Max 100 sync events/hour.
* **Duplicate Detection:** If the Backend detects identical message hashes from the same Agent within 10 seconds, it triggers a "Stuck Agent" alert and disconnects the socket.

### 4.2 The "Keep-Alive" Monitor
* **Heartbeat:** The Backend expects a `PING` from every connected Agent every 30 seconds.
* **Dormancy Logic:** If an Agent misses 3 heartbeats, it is marked `OFFLINE`. The Backend must then:
    1.  Remove it from the active routing table.
    2.  Notify the Admin via a Slack System Alert.

### 4.3 The "Black Box" Recorder (Langfuse)
* **Trace Aggregation:** The Backend must accept async trace IDs from Agents.
* **Audit Trail:** Every "Action" (Slack Message, ClickUp Comment) stored in the database must be linked to a **Langfuse Trace ID**, allowing Admins to click a button and see exactly *why* the agent took that action.

---

## 5. Data Models (High Level)

The Backend manages the relationships between tools.

| Concept | Definition | Product implication |
| :--- | :--- | :--- |
| **Tenant** | A company/organization. | Data isolation (Tenant A cannot search Tenant B's vectors). |
| **Mapping** | A link between `ClickUp List ID` <-> `Slack Channel ID`. | Defines where the "Mirror" exists. |
| **Agent Profile** | Metadata (Name, Role, Avatar, Owner). | Used for display in Slack/ClickUp. |
| **Economy** | Usage logs (Token count, API calls). | Used for auditing and cost tracking. |

---

## 6. Success Constraints

* **Latency:** The `Ingest -> Route -> Dispatch` pipeline must take **< 200ms**. The Agent needs maximum time to "think," so the platform overhead must be negligible.
* **Uptime:** The Ingestion Engine must be decoupled from the Agent Gateway. If the Agent Gateway crashes, Webhooks should still be accepted and queued.