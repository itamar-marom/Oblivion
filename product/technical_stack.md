# 🏗️ TECHNICAL STACK: Kubernetes Native Architecture

| Metadata | Details |
| :--- | :--- |
| **Document Owner** | Engineering Lead |
| **Scope** | Infrastructure, DevOps, & Tooling |
| **Status** | 🟢 Approved |

---

## 1. Core Philosophy: "K8s Native"
Oblivion is designed to run as a distributed system on **Kubernetes**.
* **Stateless Compute:** The core services (Nexus, Dashboard) are stateless and scale horizontally via HPA (Horizontal Pod Autoscalers).
* **Declarative Config:** All infrastructure is defined as code (Helm Charts / Kustomize).
* **Ephemerality:** Pods can die and restart without losing data or context.

---

## 2. Application Layer (The Microservices)

### 2.1 The Nexus (Backend Core)
* **Language:** **TypeScript (Node.js)**
* **Framework:** **NestJS**
    * *Why:* Structured, modular, and excellent support for WebSocket Gateways.
* **Runtime:** Distroless Node.js Container (Lightweight, secure).
* **Role:** Handles API requests, Webhooks, and manages WebSocket connections to agents.

### 2.2 The Observer (Frontend Dashboard)
* **Framework:** **Next.js (React)**
* **Styling:** Tailwind CSS + Shadcn UI.
* **Rendering:** SSR (Server Side Rendering) for initial load; Client-side for the WebSocket feed.
* **Role:** The Admin Control Plane.

### 2.3 The Agent Runtime (Reference Implementation)
* **Language:** **Python 3.11+**
* **Framework:** **LangGraph** (State orchestration) + **FastAPI** (Webhook listener).
* **Role:** The actual AI worker logic.
* *Note:* Agents can run inside the cluster (as Pods) or outside (on user laptops/servers).

---

## 3. Data & Persistence Layer

### 3.1 Primary Database (Relational)
* **Technology:** **PostgreSQL 16**
* **Role:** Source of truth for Users, Projects, Task Mappings, and Auth Tokens.
* **K8s Implementation:** Managed Service (AWS RDS / Google Cloud SQL) recommended for Prod; **CloudNativePG Operator** for bare metal clusters.

### 3.2 Vector Database (Memory)
* **Technology:** **Qdrant**
* **Role:** Stores semantic embeddings of Slack history and ClickUp docs.
* **Why Qdrant?** It is written in Rust (fast), has a native Kubernetes Operator, and supports payload filtering (essential for project isolation).

### 3.3 Message Broker (The Glue)
* **Technology:** **Redis**
* **Role:**
    1.  **Pub/Sub:** Distributes WebSocket events across multiple Nexus Pods.
    2.  **Queue:** Backing store for **BullMQ** (Ingestion buffers, Retry queues).
    3.  **Cache:** Short-term storage for "Who is Online" status.

---

## 4. LLM Ops & Observability

### 4.1 LLM Tracing
* **Technology:** **Langfuse**
* **Role:** "The Black Box Recorder" for AI.
* **Usage:**
    * Every time an Agent "thinks," it sends a trace to Langfuse.
    * Tracks: Token usage, Latency, Cost, and Prompt/Response pairs.
    * *Integration:* The Nexus proxy sends metadata to Langfuse asynchronously.

### 4.2 Application Monitoring
* **Technology:** **OpenTelemetry (OTEL)**
* **Role:** Captures standard metrics (CPU, Memory, HTTP Status Codes).
* **Destination:** Prometheus + Grafana.
