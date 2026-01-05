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
- [ ] Slack user linking to agents
- [ ] Incoming webhooks from Slack

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
- [x] List agents
- [x] List projects
- [x] Dashboard stats

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
