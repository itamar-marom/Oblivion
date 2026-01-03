# Nexus - TODO Features

Last updated: 2026-01-03

Items marked with TODO in the codebase that need implementation.

---

## High Priority (Phase 2.2 & 2.3 - Integration Logic)

### ClickUp API Client
**Location:** Needs new file `src/integrations/clickup/clickup.service.ts`

- [ ] Fetch full task details by task ID
- [ ] Get task description for @mention parsing
- [ ] Post comments to tasks (Slack → ClickUp sync)
- [ ] API authentication (OAuth2 or API token)

**Referenced in:**
- `src/webhooks/processors/clickup.processor.ts:83` - "TODO: Fetch full task details from ClickUp API"
- `src/webhooks/processors/clickup.processor.ts:147` - "TODO: Get from ClickUp API"
- `src/webhooks/processors/slack.processor.ts:144` - "TODO: Sync message to ClickUp as comment"

### Slack API Client
**Location:** Needs new file `src/integrations/slack/slack.service.ts`

- [ ] Post message with Block Kit (the "Root Message")
- [ ] Return `thread_ts` for task mapping storage
- [ ] Post thread replies
- [ ] API authentication (Bot token)

**Referenced in:**
- `src/webhooks/processors/clickup.processor.ts:111` - "TODO: Create Slack thread via Slack API"
- `src/webhooks/processors/clickup.processor.ts:123` - placeholder `thread_ts` needs real value

### @Mention Parsing
**Location:** `src/webhooks/processors/clickup.processor.ts`

- [ ] Parse `@AI_Squad` and similar mentions from task description
- [ ] Resolve aliases to agent IDs via `agent_aliases` table
- [ ] Route tasks to specific agents (not broadcast to all)

**Referenced in:**
- `src/webhooks/processors/clickup.processor.ts:107` - "TODO: Parse @mentions from task description"

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

### Task Status Sync
**Location:** `src/webhooks/processors/clickup.processor.ts`

- [ ] Parse `history_items` from task update webhooks
- [ ] Update task mapping status based on ClickUp status changes
- [ ] Emit `CONTEXT_UPDATE` for status changes

**Referenced in:**
- `src/webhooks/processors/clickup.processor.ts:185-186` - "TODO: Parse status changes from history_items"

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

### Phase 3: Agent Ecosystem
- [ ] Python SDK (`packages/sdk-python`)
- [ ] Agent containerization (Dockerfile)
- [ ] LangGraph integration
- [ ] MCP server integration (`mcp-server-github`)
- [ ] Context search API (`agent.search_history()`)

### Phase 4: Observer Dashboard
- [ ] Next.js frontend (`apps/observer`)
- [ ] Mapping UI (ClickUp Lists ↔ Slack Channels)
- [ ] Agent roster view
- [ ] Live feed via WebSocket

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
