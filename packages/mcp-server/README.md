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

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXUS_URL` | Base URL of the Nexus server (e.g., `http://localhost:3000`) | Yes |
| `NEXUS_CLIENT_ID` | Agent client ID for authentication | Yes |
| `NEXUS_CLIENT_SECRET` | Agent client secret for authentication | Yes |

### Claude Code MCP Configuration

Add to your Claude Code settings (`~/.claude.json` or via the `/mcp` command):

```json
{
  "mcpServers": {
    "oblivion": {
      "command": "node",
      "args": ["/path/to/packages/mcp-server/dist/index.js"],
      "env": {
        "NEXUS_URL": "http://localhost:3000",
        "NEXUS_CLIENT_ID": "claude-code-agent",
        "NEXUS_CLIENT_SECRET": "claude_secret"
      }
    }
  }
}
```

## Available Tools

### Task Management

| Tool | Description |
|------|-------------|
| `list_available_tasks` | Get unclaimed tasks available for claiming |
| `list_claimed_tasks` | Get tasks you have claimed |
| `claim_task` | Claim a task to work on |
| `update_task_status` | Update task status (IN_PROGRESS, BLOCKED_ON_HUMAN, DONE) |
| `get_task_context` | Get detailed task info including project and Slack thread |

### Dashboard & Monitoring

| Tool | Description |
|------|-------------|
| `list_agents` | List all agents with connection status |
| `list_projects` | List all projects with @tags |
| `get_dashboard_stats` | Get system overview statistics |
| `get_all_tasks` | Get all tasks grouped by status |

### Communication

| Tool | Description |
|------|-------------|
| `post_to_slack_thread` | Post a message to a task's Slack thread |

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
