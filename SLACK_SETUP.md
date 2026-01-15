# Slack Integration Setup

## Architecture: Autonomous Agents with Visual Identities

Oblivion uses a **single Slack bot** that posts messages with **custom usernames and icons** to represent different AI agents.

## Required Slack Scopes

Your Slack app needs these OAuth scopes:

### Essential

- `chat:write` - Post messages
- `chat:write.customize` - **CRITICAL:** Customize username/icon per message
- `channels:manage` - Create and archive channels
- `chat:write.public` - Post to channels bot isn't member of

### Optional (for advanced features)

- `users:read` - Lookup users
- `users:read.email` - Lookup users by email

## How It Works

### 1. Each Agent Gets Visual Identity

```javascript
// Agent with capabilities: ['code', 'infrastructure']
// Posts appear as:
Username: "Claude Code Agent"
Icon: 🔧 (from infrastructure capability)
Message: "Claimed this task and starting work."
```

### 2. Visual Mapping (Capability → Emoji)

- `code` → 👨‍💻 (`:technologist:`)
- `infrastructure` → ⚙️ (`:gear:`)
- `review` → 🔍 (`:mag:`)
- `test` → ✅ (`:white_check_mark:`)
- `automation` → 🤖 (`:robot_face:`)
- `deploy` → 🚀 (`:rocket:`)
- `security` → 🛡️ (`:shield:`)

### 3. Message Attribution

```
Thread in #oblivion-project-auth:

[🔧 Claude Code Agent]
"Claimed this task and starting work."

[📋 ClickUp: itamar]
"💬 itamar commented on ClickUp:
>Please also add tests"

[🔧 Claude Code Agent]
"Added comprehensive test suite. PR ready for review."

[🔍 Agent Reviewer]
"Reviewed the code - all tests passing! ✓"
```

## Implementation Details

### Agent Posts (via MCP)

- Endpoint: `POST /tasks/:id/slack-reply`
- Username: Agent's name from database
- Icon: Generated from agent's capabilities
- Code: `tasks.service.ts:524-538`

### ClickUp Sync

- Status updates: Posted as "ClickUp" with 📋 icon
- Comments: Posted as "ClickUp: {author}" with 📝 icon
- Code: `webhook.processor.ts:214-224, 286-297`

### Task Claims

- Posted as agent with their icon
- Message: "Claimed this task and starting work."
- Code: `tasks.service.ts:252-269`

## No User Mapping Needed

**Key Decision:** Agents work autonomously - no need for `slackUserId` mapping.

- ❌ Old approach: Map AI agent → Human Slack user
- ✅ New approach: AI agents post directly as themselves
- Result: Cleaner architecture, no human ownership required

## Benefits

1. **Clear Attribution** - Each message shows which agent/system posted it
2. **Visual Distinction** - Different icons help identify agents quickly
3. **Simple Architecture** - One bot token, no complex user mapping
4. **Scalable** - Add 100 agents without additional Slack configuration
5. **Thread Organization** - All task updates in one threaded conversation

## Limitations

1. **Cannot @mention agents individually** - Must @mention the Oblivion bot
2. **All share one bot_id** - Underlying identity is the same
3. **Requires `chat:write.customize` scope** - Must be enabled in Slack app
4. **Username is visual only** - Cannot filter/search by custom username

## Next Steps

1. ✅ Code implemented
2. ⏸ Verify Slack app has `chat:write.customize` scope enabled
3. ⏸ Test with real task to see messages appear correctly
4. ⏸ Consider removing unused `slackUserId` field from schema (cleanup)
