# 🖥️ PRODUCT SPEC: The Observer Dashboard

| Metadata | Details |
| :--- | :--- |
| **Document Owner** | Product Management |
| **Scope** | The "God Mode" Admin UI |
| **Status** | 🟡 Draft |

---

## 1. Executive Summary
The **Observer Dashboard** is the control center for the Oblivion Platform. It is **not** a tool for doing work (that happens in Slack/ClickUp). It is a tool for **Configuration & Observability**.

**Primary User Goal:** "I want to connect a new Project, see if my Agents are online, and debug why a task failed to sync."

---

## 2. Information Architecture (Sitemap)

The application is a **Next.js** Single Page App (SPA) with the following structure:

* **Home (The Pulse):** Live activity feed of the system.
* **Agents (The Roster):** Management of the AI workforce.
* **Connections (The Map):** Linking ClickUp Lists $\leftrightarrow$ Slack Channels.
* **Logs (The Black Box):** Raw request/response viewer for debugging.
* **Settings:** API Keys and Billing.

---

## 3. Key Feature Specs

### 3.1 The "Live Pulse" (Home)
**Goal:** Show the Admin that the system is alive and working.

* **Visual:** A real-time scrolling terminal-like feed (using WebSocket events).
* **Data:**
    * `[SUCCESS] Synced Task #821 to Slack` (Green)
    * `[INFO] Agent "Coder" joined #proj-auth` (Blue)
    * `[ERROR] Rate Limit hit on ClickUp API` (Red)
* **Interaction:** Clicking any line item opens the detailed **Log Viewer**.

### 3.2 The Agent Roster
**Goal:** Manage the "Employees."

* **The Grid View:** A card for every registered Agent.
    * **Status Dot:** 🟢 Online / 🔴 Offline / 🟡 Busy.
    * **Metadata:** Name, Role, and "Last Seen" timestamp.
* **Controls:**
    * **Kick:** Disconnects the Agent's WebSocket immediately.
    * **Ban:** Revokes the Agent's Client ID (preventing reconnection).
    * **Assign:** A dropdown to manually add an Agent to a specific Project.

### 3.3 Connection Manager (The Mapper)
**Goal:** The core configuration screen where "Mirroring" is set up.

* **UI Pattern:** A Split View.
    * **Left Column:** ClickUp Spaces/Lists (fetched via API).
    * **Right Column:** Slack Channels (fetched via API).
* **Action:** Drag-and-drop (or simple dropdown selection) to draw a line between a List and a Channel.
* **State:** A toggle switch for `Sync Active` / `Sync Paused`.

### 3.4 The "Black Box" (Trace View)
**Goal:** Debugging when things go wrong.

* **Scenario:** An agent claims it replied, but nothing appeared in ClickUp.
* **UI:** A Gantt-chart style view of a single interaction.
    * `0ms` : Webhook Received (Slack)
    * `+10ms`: Parsed Intent ("Final Report")
    * `+50ms`: Sent to ClickUp API
    * `+900ms`: ClickUp API responded `200 OK`
* **Why:** This proves to the user whether the error was *Oblivion's* fault or *ClickUp's* fault.

---

## 4. UI/UX Guidelines

* **Aesthetic:** "High-Tech Industrial." Dark mode by default. Monospace fonts for data.
* **Framework:** **Shadcn UI** (Radix) + **Tailwind CSS**.
* **Components:**
    * Use `Badge` components heavily for status (e.g., `SYNCING`, `ERROR`).
    * Use `Toast` notifications for system alerts.
    * Use `Skeleton` loaders for fetching external API lists (ClickUp/Slack).

---

## 5. Security Constraints

* **Auth:** The Dashboard is protected by **Clerk** or **NextAuth**. Only Admins can log in.
* **Read-Only Mode:** Junior Admins can view logs but cannot Revoke Keys or Ban Agents.

---

## 6. Future Scope (Post-MVP)

* **Cost Explorer:** A chart showing "Dollars spent on LLM Tokens per Project."
* **Agent Health:** A graph showing "Error Rate per Agent" over time.