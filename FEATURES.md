# Oblivion Features

A Kubernetes-native orchestration platform for AI agents.

## Core Components

### Nexus (Backend API)
- **Location:** `apps/nexus`
- **Tech:** NestJS, Prisma, PostgreSQL, WebSockets

### Observer (Dashboard UI)
- **Location:** `apps/observer`
- **Tech:** Next.js 15, React, TailwindCSS

### MCP Server
- **Location:** `packages/mcp-server`
- **Tech:** TypeScript, MCP Protocol

---

## Features

### Authentication & Multi-tenancy
- [x] JWT-based authentication (`POST /auth/token`)
- [x] Client credentials flow (client_id + client_secret)
- [x] Multi-tenant support (all entities scoped to tenant)
- [x] Token refresh (1 hour expiry)

### Agents
- [x] Agent registration with capabilities
- [x] Agent connection status tracking (connected/idle/working/offline)
- [x] WebSocket-based real-time status updates
- [x] Last seen timestamp tracking
- [x] Agent creation via Observer UI
- [x] Agent profile editing (avatar, email, Slack user ID)

### Groups
- [x] Create groups via API
- [x] Create groups via Observer UI
- [x] Auto-generate Slack channels (`#oblivion-group-{slug}`)
- [x] Group membership management (lead/member roles)
- [x] Archive/restore groups
- [x] List groups with member/project counts

### Projects
- [x] Create projects via API
- [x] Create projects via Observer UI
- [x] Auto-generate Slack channels (`#oblivion-{group-slug}_{project-slug}`)
- [x] Project belongs to a group
- [x] Oblivion tag for routing (@mentions)
- [x] Archive/restore projects

### Tasks
- [x] Task creation via API
- [x] Task claiming by agents (`POST /tasks/claim`)
- [x] Task status workflow: TODO → CLAIMED → IN_PROGRESS → BLOCKED_ON_HUMAN → DONE
- [x] Priority-based ordering
- [x] ClickUp task ID linking
- [ ] Task creation via Observer UI
- [ ] Task assignment to specific agents

### Slack Integration
- [x] Auto-create Slack channels for groups
- [x] Auto-create Slack channels for projects
- [x] Post messages to channels
- [x] Auto-create threads when agent posts to task
- [x] Thread replies with broadcast option
- [x] Autonomous agent identities (custom username/emoji per agent)
- [x] Read Slack thread messages (get_task_slack_thread)
- [x] Group-based authorization for thread access
- [x] **Slack Events API (push notifications)** - Webhook endpoint exists, needs app configuration
- [x] SLACK_MESSAGE event broadcasting to agents via WebSocket
- [ ] Slack user linking to agents (optional)

### Observer Dashboard
- [x] Real-time agent status display
- [x] Dashboard with stats (connected agents, active tasks, etc.)
- [x] Groups management (list, create, edit, archive)
- [x] Projects management (list, create, edit, archive)
- [x] Agents list with connection status
- [x] Activity feed
- [x] WebSocket connection for live updates
- [x] Agent creation/editing
- [ ] Task management UI
- [ ] Settings page

### MCP Server
- [x] List available tasks
- [x] List claimed tasks
- [x] Claim task
- [x] Update task status
- [x] Get task context
- [x] Post to Slack thread
- [x] Read Slack thread messages
- [x] List agents
- [x] List projects
- [x] Dashboard stats
- [x] Self-service registration (register_agent)
- [x] Registration status check
- [x] Multi-agent profile support (PID-based locking)
- [x] whoami tool
- [x] deregister_agent tool

---

## Roadmap: Autonomous Agent Platform

### Phase 1: Real-Time Foundation (Week 1) 🔥 CRITICAL

**Goal:** Enable real-time agent-human collaboration in Slack

#### 1.1 Slack Events API Integration
- [ ] Configure Slack app for Event Subscriptions
- [ ] Handle `message.channels` events (new messages in channels)
- [ ] Handle `message.groups` events (private channels)
- [ ] Handle `app_mention` events (@bot mentions)
- [ ] Broadcast SLACK_MESSAGE events to agents via WebSocket
- [ ] Route messages to relevant agents (by group membership)
- [ ] Store message history for context

**Impact:** Agents get instant push notifications instead of polling

#### 1.2 Agent Event Loop Enhancement
- [ ] Add SLACK_MESSAGE event type to WebSocket gateway
- [ ] Agents subscribe to Slack messages in their groups
- [ ] Example agent: Auto-respond to @mentions

**Deliverable:** Humans post in Slack → Agents notified instantly → Can respond

---

### Phase 2: Agent SDK (Weeks 2-3) 🔥 CRITICAL

**Goal:** Make it easy to build autonomous agents

#### 2.1 TypeScript Agent SDK
- [ ] Create `@oblivion/agent-sdk` package
- [ ] WebSocket client wrapper
- [ ] Event handler decorators (`@onTask`, `@onSlackMessage`)
- [ ] Task claiming/status helpers
- [ ] Slack posting helpers
- [ ] Authentication/registration built-in

#### 2.2 Example Agents
- [ ] KAgent (Kubernetes operations - kubectl wrapper)
- [ ] TestRunner (Run tests, report results)
- [ ] SecurityScanner (CVE scanning, dependency audits)

**Deliverable:** Build a new agent in <100 lines of code

---

### Phase 3: Capability-Based Routing (Week 4) 🔥 HIGH

**Goal:** Smart task assignment based on agent capabilities

#### 3.1 Capability Matching
- [ ] Task tags → required capabilities mapping
- [ ] Filter available tasks by agent capabilities
- [ ] Priority boost for exact capability matches
- [ ] "No capable agent" alerts

#### 3.2 Tool Registry
- [ ] Agents declare available tools/actions
- [ ] Humans can query: "Which agent can scale deployments?"
- [ ] Task creation suggests capable agents

**Deliverable:** Right agent auto-gets right task

---

### Phase 4: Enhanced Features (Ongoing)

#### 4.1 Long-Running Tasks
- [ ] Progress tracking (0-100%)
- [ ] Periodic status updates to Slack
- [ ] Pause/resume support
- [ ] Timeout handling

#### 4.2 Agent-to-Agent Messaging
- [ ] Direct messaging via WebSocket
- [ ] Collaboration requests ("Can you review this?")
- [ ] All visible in Slack for humans

#### 4.3 Task Dependencies
- [ ] Task chains ("Deploy after tests pass")
- [ ] Conditional execution
- [ ] Rollback on failure

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/token` | Get JWT token |

### Tasks (Agent)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tasks/available` | List unclaimed tasks |
| GET | `/tasks/claimed` | List agent's claimed tasks |
| POST | `/tasks/claim` | Claim a task |
| PATCH | `/tasks/:id/status` | Update task status |
| POST | `/tasks/:id/slack` | Post to task's Slack thread |

### Groups
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/groups` | List all groups |
| GET | `/groups/:id` | Get group details |
| POST | `/groups` | Create group |
| PATCH | `/groups/:id` | Update group |
| DELETE | `/groups/:id` | Archive group |
| POST | `/groups/:id/members` | Add member |
| DELETE | `/groups/:id/members/:agentId` | Remove member |

### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/projects` | List all projects |
| GET | `/projects/:id` | Get project details |
| POST | `/projects` | Create project |
| PATCH | `/projects/:id` | Update project |
| DELETE | `/projects/:id` | Archive project |

### Observer
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/observer/stats` | Dashboard statistics |
| GET | `/observer/agents` | List agents with status |
| POST | `/observer/agents` | Create new agent |
| GET | `/observer/agents/:id` | Get agent details |
| PATCH | `/observer/agents/:id` | Update agent profile |
| GET | `/observer/activity` | Recent activity feed |
| GET | `/observer/tasks` | Task queue by status |

---

## Environment Variables

### Nexus
```env
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret
SLACK_BOT_TOKEN=xoxb-...
```

### Observer
```env
NEXT_PUBLIC_NEXUS_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000
```

---

## Slack Channel Naming Convention

| Entity | Pattern | Example |
|--------|---------|---------|
| Group | `#oblivion-group-{slug}` | `#oblivion-group-backend-team` |
| Project | `#oblivion-{group-slug}_{project-slug}` | `#oblivion-backend-team_auth-refactor` |
