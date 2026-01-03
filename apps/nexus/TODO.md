# Nexus - TODO Features

Last updated: 2026-01-03

Items marked with TODO in the codebase that need implementation.

---

## 🚨 CRITICAL: Groups/Projects Redesign (Phase 2.5)

**Major architectural change to support Agent teams and project-scoped work.**

See updated specs:
- `product/PRD.md` - Section 3 (Hierarchy & Data Model)
- `.ai/architecture.md` - Data Model section
- `product/integrations.md` - Hierarchy Mapping

### Database Schema Changes ✅ COMPLETE
**Location:** `prisma/schema.prisma`

- [x] Create `groups` table (Agent teams with Slack channels)
- [x] Create `agent_group_memberships` table (many-to-many Agent ↔ Group)
- [x] Create `projects` table (with `oblivion_tag` for routing)
- [x] Modify `tasks` table (add `project_id`, `claimed_by_agent_id`, `status`, `priority`)
- [x] Remove/deprecate `project_mappings` table (replaced by Groups/Projects)
- [x] Run migration (`20260103193654_add_groups_projects_tasks`)

### Group Management API ✅ COMPLETE
**Location:** `src/groups/`

- [x] `POST /groups` - Create group
- [x] `GET /groups` - List all groups
- [x] `GET /groups/:id` - Get group with members and projects
- [x] `PATCH /groups/:id` - Update group
- [x] `DELETE /groups/:id` - Archive group
- [x] `POST /groups/:id/members` - Add agent to group
- [x] `DELETE /groups/:id/members/:agentId` - Remove agent from group

### Project Management API ✅ COMPLETE
**Location:** `src/projects/`

- [x] `POST /projects` - Create project under group
- [x] `GET /projects` - List all projects (filterable by group)
- [x] `GET /projects/:id` - Get project with tasks
- [x] `PATCH /projects/:id` - Update project (including `oblivion_tag`)
- [x] `DELETE /projects/:id` - Archive project
- [x] `findByTag()` - Lookup project by @tag for routing

### Task Claiming System ✅ COMPLETE
**Location:** `src/gateway/` and `src/tasks/`

- [x] New WebSocket event: `TASK_AVAILABLE` (broadcast to group members)
- [x] New WebSocket event: `TASK_CLAIMED` (notify others task is taken)
- [x] New WebSocket event: `CLAIM_TASK` (agent requests to claim)
- [x] Claim validation (first-come-first-served with optimistic locking)
- [x] Priority ordering (from ClickUp priority field)
- [x] REST endpoints: `GET /tasks/available`, `GET /tasks/claimed`, `POST /tasks/:id/claim`, `PATCH /tasks/:id/status`
- [ ] Update Slack thread when task is claimed (requires Slack API)

### @Tag Routing ✅ COMPLETE
**Location:** `src/webhooks/processors/webhook.processor.ts`

- [x] Parse `@project-tag` from task description (e.g., `@auth-refactor`)
- [x] Lookup Project by `oblivion_tag` via `ProjectsService.findByTag()`
- [x] Get Project's Group and member Agents
- [x] Broadcast `TASK_AVAILABLE` to all Group members via `TasksService.createTask()`
- [x] Map ClickUp priority to internal priority (1-4 scale)
- [x] Legacy list-based routing preserved as fallback

**Note:** Old list-based routing kept for backward compatibility. Tasks with @tag
use new TASK_AVAILABLE event; tasks without @tag use legacy TASK_ASSIGNED event.

### Slack Channel Auto-Creation ✅ COMPLETE
**Location:** `src/integrations/slack/slack.service.ts`

- [x] Create channel when Group is created (`#oblivion-{group-slug}`)
- [x] Create channel when Project is created (`#oblivion-{project-slug}`)
- [x] Archive channel when Group/Project is archived
- [ ] Add agents to channels when they join groups (blocked: Agent model lacks slackUserId field)

**Implemented in:**
- `src/integrations/slack/slack.service.ts` - Channel management methods
- `src/groups/groups.service.ts:32-60` - Auto-create channel on group creation
- `src/groups/groups.service.ts:251-257` - Archive channel on group archive
- `src/projects/projects.service.ts:73-86` - Auto-create channel on project creation
- `src/projects/projects.service.ts:320-326` - Archive channel on project archive

### Observer Dashboard Updates ✅ COMPLETE
**Location:** `apps/observer/`

- [x] Groups management page (replace old Mappings)
- [x] Projects management page (under Groups)
- [x] Agent-to-Group assignment UI (in Groups page member preview)
- [x] Task claiming visibility in Activity feed

**Implemented in:**
- `apps/observer/app/groups/page.tsx` - Groups management with member preview
- `apps/observer/app/projects/page.tsx` - Projects management with @tag display
- `apps/observer/lib/types.ts` - Group, Project, Task, GroupMember types
- `apps/observer/hooks/use-nexus.ts` - Mock data for groups, projects, tasks
- `apps/observer/components/sidebar.tsx` - Navigation updated with Groups/Projects
- `apps/observer/app/activity/page.tsx` - task_available, task_claimed events
- `apps/observer/components/activity-feed.tsx` - Updated for new event types

---

## High Priority (Phase 2.2 & 2.3 - Integration Logic)

### ClickUp API Client ✅ COMPLETE
**Location:** `src/integrations/clickup/clickup.service.ts`

- [x] Fetch full task details by task ID (`getTask()`)
- [x] Get task description for @tag parsing (`parseOblivionTag()`)
- [x] Get task priority for claiming order (`mapPriority()`)
- [x] Post comments to tasks (Slack → ClickUp sync) (`postComment()`)
- [x] API authentication (API token via `CLICKUP_API_TOKEN` env var)
- [x] Extract task summary for Slack (`extractTaskSummary()`)
- [x] Parse @mentions (`parseMentions()`, `hasAIMention()`)

**Implemented in:**
- `src/integrations/clickup/clickup.service.ts` - Full ClickUp API client
- `src/webhooks/processors/webhook.processor.ts` - Integration with webhook processing

### Slack API Client ✅ COMPLETE
**Location:** `src/integrations/slack/slack.service.ts`

**Channel Management:**
- [x] Create channels (for Groups and Projects)
- [x] Archive channels
- [x] Add/remove users from channels (methods ready, but Agent lacks slackUserId)
- [x] Find user by email
- [x] Post welcome messages
- [x] API authentication (Bot token via SLACK_BOT_TOKEN env var)

**Task Messaging:**
- [x] Post message with Block Kit (the "Root Message") - `postTaskMessage()`
- [x] Return `thread_ts` for task storage - `SlackMessageResult.threadTs`
- [x] Post thread replies - `postThreadReply()`
- [x] Post agent status updates - `postAgentStatus()`
- [x] Format ClickUp comments for Slack - `formatCommentForSlack()`

**Implemented in:**
- `src/integrations/slack/slack.service.ts` - Full Slack API client
- `src/webhooks/processors/webhook.processor.ts` - Integration with webhook processing

### @Tag Parsing ✅ COMPLETE (replaced @Mention)
**Location:** `src/webhooks/processors/webhook.processor.ts`, `src/integrations/clickup/clickup.service.ts`

- [x] Parse `@project-tag` from task description (e.g., `@auth-refactor`)
- [x] Lookup Project by `oblivion_tag` field
- [x] Get Project's Group → Get member Agents
- [x] Broadcast `TASK_AVAILABLE` to Group members (not specific agents)

**Implemented in:**
- `src/integrations/clickup/clickup.service.ts` - `parseOblivionTag()` method
- `src/webhooks/processors/webhook.processor.ts` - @tag routing in `handleTaskCreated()`

---

## Medium Priority (Security & Validation)

### Webhook Signature Verification ✅ COMPLETE
**Location:** `src/webhooks/services/webhook-security.service.ts`

- [x] Verify ClickUp webhook signature (`x-signature` header) - HMAC-SHA256
- [x] Verify Slack webhook signature (`x-slack-signature` + `x-slack-request-timestamp`) - HMAC-SHA256 with replay protection
- [x] Timing-safe comparison to prevent timing attacks
- [x] Graceful degradation when secrets not configured (dev mode)

**Implemented in:**
- `src/webhooks/services/webhook-security.service.ts` - Security service with verification logic
- `src/webhooks/webhooks.controller.ts:74-76` - ClickUp signature check
- `src/webhooks/webhooks.controller.ts:146-148` - Slack signature check
- `src/main.ts:7-9` - Raw body parsing enabled for Slack

---

## Lower Priority (Enhanced Features)

### Task Status Sync ✅ COMPLETE
**Location:** `src/webhooks/processors/webhook.processor.ts`, `src/tasks/tasks.service.ts`

- [x] Parse `history_items` from task update webhooks
- [x] Update task status based on ClickUp status changes (both legacy TaskMapping and new Task model)
- [x] Emit `CONTEXT_UPDATE` for status changes to group members
- [x] Map ClickUp statuses to internal statuses (TODO, CLAIMED, IN_PROGRESS, BLOCKED_ON_HUMAN, DONE)
- [x] Post status updates to Slack thread

**Implemented in:**
- `src/tasks/tasks.service.ts:415-509` - `syncStatusFromClickUp()` method
- `src/webhooks/processors/webhook.processor.ts:316-454` - `handleTaskUpdated()` with history_items parsing

### Task Comment Handling
**Location:** `src/webhooks/processors/clickup.processor.ts`

- [ ] Fetch comment details from ClickUp API
- [ ] Post comment content to Slack thread
- [ ] Emit `CONTEXT_UPDATE` to agents

**Referenced in:**
- `src/webhooks/processors/clickup.processor.ts:215-217`

### App Mention Commands
**Location:** `src/webhooks/processors/slack.processor.ts`

- [ ] Parse commands from @bot mentions
- [ ] Route to appropriate agent or respond directly

**Referenced in:**
- `src/webhooks/processors/slack.processor.ts:155-156`

### Channel Auto-Mapping
**Location:** `src/webhooks/processors/slack.processor.ts`

- [ ] Notify admins when new channels are created
- [ ] Suggest project mapping creation

**Referenced in:**
- `src/webhooks/processors/slack.processor.ts:169-170`

---

## Future Phases

### Phase 3: Agent Ecosystem ✅ CORE COMPLETE
- [x] Python SDK (`packages/sdk-python`)
  - WebSocket client (Socket.IO)
  - JWT authentication
  - Typed event models (Pydantic)
  - Async event handler decorators
- [x] Agent containerization (Dockerfile)
- [x] LangGraph integration (example agent)
- [ ] MCP server integration (`mcp-server-github`) - Future
- [ ] Context search API (`agent.search_history()`) - Future

**Implemented in:**
- `packages/sdk-python/src/oblivion/client.py` - Main client
- `packages/sdk-python/src/oblivion/models.py` - Event models
- `packages/sdk-python/examples/simple_agent.py` - Basic agent
- `packages/sdk-python/examples/langgraph_agent.py` - LangGraph agent
- `packages/sdk-python/Dockerfile` - Container build

### Phase 4: Observer Dashboard ✅ CORE COMPLETE
- [x] Next.js frontend (`apps/observer`)
- [x] Mapping UI (ClickUp Lists ↔ Slack Channels)
- [x] Agent roster view
- [x] Live feed via WebSocket
- [x] Activity log with filtering
- [x] Settings page (Nexus connection, integrations, notifications, security)

**Implemented in:**
- `apps/observer/app/page.tsx` - Dashboard with stats and live feed
- `apps/observer/app/agents/page.tsx` - Agent roster with status cards
- `apps/observer/app/mappings/page.tsx` - Project mappings management
- `apps/observer/app/activity/page.tsx` - Activity log with filters
- `apps/observer/app/settings/page.tsx` - Configuration settings
- `apps/observer/hooks/use-nexus.ts` - WebSocket connection hook
- `apps/observer/components/` - Reusable UI components

### Phase 5: Production Hardening
- [ ] OpenTelemetry instrumentation
- [ ] Rate limiting (`ThrottlerGuard`)
- [ ] Circuit breaker for agent spam
- [ ] Disaster recovery testing

---

## Code Locations Quick Reference

| Feature | File | Line |
|---------|------|------|
| ClickUp task fetch | `clickup.processor.ts` | 83 |
| Slack thread creation | `clickup.processor.ts` | 111 |
| @mention parsing | `clickup.processor.ts` | 107 |
| ClickUp comment post | `slack.processor.ts` | 144 |
| ClickUp signature | `webhooks.controller.ts` | 69-72 |
| Slack signature | `webhooks.controller.ts` | 143-146 |
