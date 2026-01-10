# Oblivion MCP Server

MCP (Model Context Protocol) server that connects Claude Code to the Oblivion/Nexus task management system.

## Overview

This MCP server exposes Nexus task management capabilities as tools that Claude Code can invoke. This enables Claude Code to:

- List and claim available tasks
- Update task status
- Post to Slack threads
- View agents, projects, and dashboard stats

## Installation

```bash
cd packages/mcp-server
pnpm install
pnpm build
```

## Configuration

### Quick Start (Recommended)

**One-time setup - no manual credential management:**

```bash
claude mcp add oblivion \
  --command "node" \
  --args "/path/to/packages/mcp-server/dist/index.js" \
  --env NEXUS_URL=http://localhost:3000
```

Then in Claude Code:
1. Get a registration token from admin (Observer dashboard)
2. Ask: `"Register me with token reg_abc123, clientId 'my-agent', secret 'my_password'"`
3. Wait for admin approval
4. Restart Claude Code - **credentials auto-load!**

### Multi-Agent Support

Run multiple agents on the same host:

```bash
# First agent (auto-uses last registered)
claude mcp add oblivion \
  --command "node" --args "/path/to/dist/index.js" \
  --env NEXUS_URL=http://localhost:3000

# Second agent (specify profile)
claude mcp add oblivion-reviewer \
  --command "node" --args "/path/to/dist/index.js" \
  --env NEXUS_URL=http://localhost:3000 \
  --env OBLIVION_PROFILE=agent-reviewer
```

All agents store credentials in `~/.oblivion/credentials.json`.

### Manual Configuration (Alternative)

You can still use env vars if you prefer:

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXUS_URL` | Base URL of Nexus server | Yes |
| `NEXUS_CLIENT_ID` | Agent client ID | No* |
| `NEXUS_CLIENT_SECRET` | Agent secret | No* |
| `OBLIVION_PROFILE` | Profile name to use from saved credentials | No |

*If not provided, loads from `~/.oblivion/credentials.json`

### Credential Storage

**Location:** `~/.oblivion/credentials.json`
**Permissions:** `600` (owner read/write only)

**Format:**
```json
{
  "agents": {
    "agent-1": {
      "nexusUrl": "http://localhost:3000",
      "clientId": "agent-1",
      "clientSecret": "secret1",
      "agentName": "Code Agent",
      "savedAt": "2026-01-10T..."
    },
    "agent-2": { ... }
  },
  "activeProfile": "agent-1"
}
```

## Available Tools

### Registration (No Credentials Needed)

| Tool | Description |
|------|-------------|
| `register_agent` | Self-register with a registration token - credentials auto-saved! |
| `check_registration_status` | Check if your registration has been approved |

### Task Management (Requires Credentials)

| Tool | Description |
|------|-------------|
| `list_available_tasks` | Get unclaimed tasks available for claiming |
| `list_claimed_tasks` | Get tasks you have claimed |
| `claim_task` | Claim a task to work on (posts to Slack as agent) |
| `update_task_status` | Update task status (IN_PROGRESS, BLOCKED_ON_HUMAN, DONE) |
| `get_task_context` | Get detailed task info including project and Slack thread |
| `get_all_tasks` | Get all tasks grouped by status |

### Dashboard & Monitoring

| Tool | Description |
|------|-------------|
| `list_agents` | List all agents with connection status |
| `list_projects` | List all projects with @tags |
| `get_dashboard_stats` | Get system overview statistics |

### Communication

| Tool | Description |
|------|-------------|
| `post_to_slack_thread` | Post to task's Slack thread (appears as agent with custom emoji) |

## Development

```bash
# Build
pnpm build

# Watch mode
pnpm dev

# Test with MCP Inspector
pnpm inspect
```

## Testing

After configuring Claude Code with the MCP server:

1. Start Nexus: `cd apps/nexus && pnpm start:dev`
2. Reseed database: `pnpm db:seed` (includes Claude Code agent)
3. Restart Claude Code to load the MCP server
4. Try commands like "list available tasks" or "show dashboard stats"

## Credentials (Development)

```
Client ID:     claude-code-agent
Client Secret: claude_secret
```
