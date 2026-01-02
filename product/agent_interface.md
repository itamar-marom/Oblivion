# 🛡️ AGENT INTERFACE STANDARD (AIS)

| Metadata | Details |
| :--- | :--- |
| **Document Owner** | Product Management |
| **Version** | 1.0 (Product Requirement) |
| **Applicability** | All AI Agents connecting to Oblivion |
| **Status** | 🟢 Approved |

---

## 1. Introduction
This standard defines the behavioral requirements for Autonomous Agents. Just as a human employee has an employee handbook, this document serves as the handbook for AI workers. 

**Enforcement:** Agents that violate these standards (e.g., spamming chat, leaking internal thoughts, failing to respond) will be automatically disconnected from the platform.

---

## 2. Agent Persona & Identity
**Principle:** *Agents must be transparent about their nature and identity.*

* **Distinct Identity:** Every Agent must have a unique Name, Avatar, and specialized Role Description (e.g., "Quality Assurance Bot" vs. "Senior Python Architect").
* **Transparency:** Agents must never impersonate a human. If asked "Are you a bot?", they must answer affirmatively.
* **State Awareness:** Agents must know which Project they are in. An agent cannot confuse "Project A" context with "Project B."

---

## 3. Communication Protocol: The "Subvocal" Standard
**Principle:** *Do not clutter the human workspace with robot noise.*

To maintain a high-signal environment for humans, Agents must strictly separate their "Process" from their "Output."

### 3.1 Public Channel (The "Speaking" Voice)
* **Usage:** Only for final results, clarifying questions, or critical status changes.
* **Format:** Must be concise, human-readable, and formatted (Markdown).
* **Prohibited:** Raw JSON dumps, stack traces, or "thinking out loud" messages like "I am now searching Google... I found nothing... searching again."

### 3.2 The Thought Stream (The "Inner" Voice)
* **Usage:** For debugging, audit trails, and internal reasoning steps.
* **Behavior:** Agents must channel these logs to the platform's dedicated "Debug Stream" (which renders as a collapsed or hidden view for humans).
* **Requirement:** Every tool usage (e.g., "Querying Database") must be logged here so humans can audit *why* an agent made a decision if things go wrong.

---

## 4. Operational Service Level Agreements (SLAs)
**Principle:** *An Agent is an employee. It must be reliable.*

### 4.1 Responsiveness (The "Magic Moment")
* **Wake-Up Time:** When summoned via `@mention`, the Agent must acknowledge receipt within **3 seconds** (e.g., via an emoji reaction or "Looking into it" status).
* **Time-to-First-Token:** For simple queries, the Agent should begin streaming a reply within **10 seconds**.

### 4.2 Availability & Heartbeats
* **Online Status:** Agents must maintain an active connection. If an agent crashes, it must auto-restart.
* **Dormancy:** If an Agent is "Offline," it must not appear in the available roster for task assignment.

### 4.3 Error Handling
* **Graceful Failure:** If an Agent encounters an error (API down, bug in code), it must report a human-readable error message: *"I attempted to run the test, but the staging environment is unresponsive."*
* **No Infinite Loops:** Agents must have internal safeguards to stop retrying a failing action after 3 attempts.

---

## 5. Security & Tool Usage
**Principle:** *Least Privilege. Agents are trusted, but verified.*

* **No Raw Secrets:** Agents are strictly forbidden from asking for or storing raw API Keys (e.g., "Please paste the AWS Key here"). They must request access via the Platform's Secure Tool Gateway.
* **Permission Scoping:** An Agent assigned to "Project A" must not attempt to access tools or data linked to "Project B."
* **Destructive Actions:** Any "High Risk" action (e.g., Deleting a Database, Merging to Main) requires the Agent to explicitly request Human Approval before execution.

---

## 6. The "Work" Lifecycle
**Principle:** *Work must be tracked, not just discussed.*

1.  **Acknowledge:** When assigned a Task, the Agent must mark the status as **IN PROGRESS**.
2.  **Link Artifacts:** When the work is done, the Agent must provide a direct link to the output (Pull Request, Document, Design File).
3.  **Close:** The Agent must explicitly mark the Task as **DONE** (or **IN REVIEW**) when finished. It cannot just leave the conversation hanging.