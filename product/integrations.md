# 🔗 PRODUCT SPEC: The Mirror Integration

| Metadata | Details |
| :--- | :--- |
| **Document Owner** | Product Management |
| **Scope** | ClickUp ↔ Slack Bi-Directional Sync |
| **Status** | 🟡 Draft for Review |

---

## 1. The Core Concept: "Context Mirroring"
We are not building a simple notification bot. We are building a **State Mirror**.

* **ClickUp** is the "Source of Truth" for **Goals & Status**.
* **Slack** is the "Source of Truth" for **Discussion & Execution**.

**The Goal:** A human manager should be able to live entirely in ClickUp and see the work happening. An AI Agent should be able to live entirely in Slack and see the requirements changing.

---

## 2. The Hierarchy Mapping
We map the structure of the two tools so they feel like one cohesive workspace.

### 2.1 Level 1: The Project (Container)
* **ClickUp Entity:** A `List` (e.g., "Mobile App Redesign").
* **Slack Entity:** A `Channel` (e.g., `#proj-mobile-redesign`).
* **Logic:**
    * When a **new List** is linked to Oblivion, a corresponding **Slack Channel** is automatically created (or mapped).
    * If the List is **Archived** in ClickUp, the Slack Channel is **Archived**.

### 2.2 Level 2: The Task (Unit of Work)
* **ClickUp Entity:** A `Task` (Ticket #825).
* **Slack Entity:** A `Thread` (inside the Project Channel).
* **Logic:**
    * We do **not** create a new channel per task (too noisy).
    * We create a single **"Root Message"** in the Project Channel for every Task. All work happens in the replies to that message.

---

## 3. The "Golden Path" (User Stories)

### Story A: The "Summoning" (Task Creation)
**As a** Product Manager,
**I want** to assign a task to AI by just tagging them in ClickUp,
**So that** I don't have to switch context to Slack to copy-paste instructions.

**Acceptance Criteria:**
1.  User creates a task in ClickUp: *"Fix the login bug. @AI_Squad please handle."*
2.  **Within 5 seconds**, a message appears in the mapped Slack channel:
    * **Title:** Link to the ClickUp Task.
    * **Status:** "READY".
    * **Context:** The description from ClickUp.
3.  The relevant Agents (`@AI_Squad`) are tagged in the Slack thread.

### Story B: The "Progress Report" (Agent Update)
**As a** Stakeholder watching ClickUp,
**I want** to see the Agent's major updates as comments on the ticket,
**So that** I know progress is happening without reading a 50-message Slack chat.

**Acceptance Criteria:**
1.  Agent posts a "Final Result" or "Question" in the Slack Thread.
2.  **Within 5 seconds**, that message appears as a **Comment** on the ClickUp Task.
3.  **Constraint:** Internal debug logs ("Checking database...") must **NOT** sync to ClickUp. Only "Public" messages sync.

### Story C: The "Feedback Loop" (Human Correction)
**As a** Developer,
**I want** to reply to the Agent via ClickUp comments,
**So that** the Agent sees my feedback immediately.

**Acceptance Criteria:**
1.  Human comments on the ClickUp Task: *"Please use the new API, not the old one."*
2.  That comment is mirrored into the **Slack Thread** so the Agent (who is listening to the thread) receives the new instruction.

---

## 4. Sync Rules & Logic Gates

To prevent infinite loops and noise, we enforce these strict rules.

### 4.1 The "Noise Gate" (What Syncs?)
| Origin | Message Type | Sync to Destination? | Reason |
| :--- | :--- | :--- | :--- |
| **Agent** | "Thinking / Debugging" | ❌ NO | ClickUp comments should be clean. |
| **Agent** | "Question / Blocker" | ✅ YES | Human attention needed. |
| **Agent** | "Final Artifact / PR" | ✅ YES | Deliverable. |
| **Human** | ClickUp Comment | ✅ YES | Instruction for Agent. |
| **Human** | Slack Message | ❌ NO | Casual chat stays in Slack. |

### 4.2 Status Mapping
When the Slack Thread reaches a conclusion, the ClickUp status should update automatically.

* **Slack Event:** Agent posts "I have opened PR #123."
* **ClickUp Action:** Move Status from `TO DO` -> `IN REVIEW`.
* **Slack Event:** Agent posts "I am blocked by missing keys."
* **ClickUp Action:** Add Tag `BLOCKED`.

---

## 5. Edge Cases (The "Unhappy" Paths)

### 5.1 Desynchronization (The Orphan)
* **Scenario:** A human deletes the Slack "Root Message" manually.
* **Product Behavior:**
    * If the Agent tries to reply and fails, it must post a **New Root Message** in the channel: *"Previous thread lost. Continuing work on Task #825 here..."*
    * It must **not** crash or go silent.

### 5.2 Edit Wars
* **Scenario:** Human edits description in ClickUp while Agent is working.
* **Product Behavior:**
    * Oblivion posts a system message in the Slack Thread: *"⚠️ Update: Task Description modified by User."*
    * This ensures the Agent knows the requirements have changed mid-flight.

### 5.3 Agent Hallucination (Spam)
* **Scenario:** An Agent gets stuck in a loop, posting 50 messages/minute.
* **Product Behavior:**
    * The **Circuit Breaker** activates.
    * Sync to ClickUp is **Paused** (to prevent spamming the manager's email).
    * A "System Alert" is posted in Slack tagging the Admin.

---

## 6. Access & Security Requirements

### 6.1 Visibility Scope
* Agents must **never** see tasks from Projects they are not assigned to.
* If a ClickUp List is "Private," the mapped Slack Channel must be "Private."

### 6.2 Credential Isolation
* Oblivion uses a **Service Account** (Bot User) to post in ClickUp. It does *not* impersonate the Human User.
* All comments posted by Oblivion must be clearly marked: *"🤖 AI (via Slack): [Message]"*