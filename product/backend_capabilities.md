# ⚙️ PRODUCT SPEC: Backend Capabilities & Architecture

| Metadata | Details |
| :--- | :--- |
| **Document Owner** | Product Management |
| **Scope** | Core Platform Logic (The Nexus) |
| **Status** | 🟢 Approved for Architecture |

---

## 1. Executive Summary
The Backend (internally codenamed "The Nexus") is the central nervous system of Oblivion. It does not store tasks (ClickUp does that) and it does not host chat (Slack does that).

**Its primary mandate is Traffic Control:** It ingests noisy signals from external tools, normalizes them, enriches them with context, and routes them to the correct AI Agents.

---

## 2. Core Capabilities

### 2.1 The Ingestion Engine ("The Ears")
The system must be able to listen to the outside world without failing, even during traffic spikes.

* **Webhook Normalization:** The system must accept payloads from **ClickUp**, **Slack**, and **GitHub**. It must convert these disparate JSON formats into a single internal `StandardEvent` format.
    * *Example:* A ClickUp `taskCreated` event and a GitHub `issue_opened` event should both look like `NewWorkItem` to the internal router.
* **Durable Buffering:** If the Agent Swarm is offline or overloaded, incoming webhooks must not be lost. They must be queued (buffered) and replayed when capacity is available.

### 2.2 The Identity Resolver ("The Rolodex")
The system acts as the source of truth for "Who is who."

* **Alias Resolution:** The backend must resolve abstract tags into concrete Agent IDs.
    * Input: `@AI_Squad` (from ClickUp).
    * Output: `["agent_uuid_1", "agent_uuid_2"]`.
* **Auth Provider:** The backend issues **OAuth2 Tokens** to Agents. It validates these tokens on every WebSocket connection to ensure rogue scripts cannot join the network.

### 2.3 The Context Engine ("The Librarian")
Agents are stateless. The Backend provides them with memory on demand.

* **Real-time RAG (Retrieval Augmented Generation):**
    * When an event is routed to an Agent, the Backend must automatically query the Vector Database for related history.
    * *Capability:* "Attach the last 5 relevant Slack threads and the Project Readme to this new Task event."
* **Summarization Service:**
    * The Backend must periodically scan active Slack threads. If a thread exceeds 50 messages, it must trigger a background job to summarize the discussion and store it as a permanent record.

---

## 3. The "Tool Gateway" (Security Layer)
This is the most critical security component. It prevents Agents from holding the "Keys to the Castle."

### 3.1 Proxy Execution
Agents never possess API keys (e.g., `GITHUB_TOKEN`, `AWS_SECRET`).
1.  **Request:** Agent sends: `{"intent": "github_push", "repo": "frontend", "branch": "feat/login"}`.
2.  **Verification:** Backend checks: *Does this Agent have write-access to the 'frontend' repo?*
3.  **Execution:** Backend retrieves the encrypted key from the Vault, executes the push, and returns the result to the Agent.

### 3.2 The "Kill Switch"
The Admin Dashboard needs a master override.
* **Capability:** The Backend must support an immediate `STOP_ALL_AGENTS` command that:
    1.  Severs all WebSocket connections.
    2.  Revokes all active Tool Gateway sessions.
    3.  Pauses all outgoing Webhooks to Slack/ClickUp.

---

## 4. Governance & Reliability

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