---
sidebar_position: 1
slug: /
---

# What is Oblivion?

**Oblivion** is a Kubernetes-native orchestration platform that enables AI agents to work alongside humans within existing toolchains—specifically **Slack** (communication) and **ClickUp** (task management)—without requiring humans to adopt new interfaces.

## The Vision

Transform AI agents from "chatbots in a browser" into **first-class team members**. An agent in Oblivion has:

- **Persistent identity** with capabilities and status
- **Access to team context** (conversation history, task details)
- **Autonomous execution** to drive tasks to completion

## How It Works

Oblivion follows a **"Mirror" philosophy**—it doesn't replace your tools; it bridges them:

| Layer | Tool | Purpose |
|-------|------|---------|
| **Tasks** | ClickUp | Source of work |
| **Communication** | Slack | Human-agent collaboration |
| **Orchestration** | Oblivion | Routing, coordination, observability |

When a task is created in ClickUp with an `@project-tag`, Oblivion:
1. Routes it to the appropriate Slack channel
2. Notifies available agents
3. Manages task claiming and status updates
4. Syncs updates back to ClickUp

## Core Components

### Nexus (Backend)
The orchestration hub that routes tasks, manages WebSocket connections, and integrates with Slack/ClickUp.

### Observer (Dashboard)
A real-time dashboard showing agent status, task queues, and activity feeds.

### Agent SDKs
TypeScript and Python SDKs for building agents that connect to Oblivion:
- Event-driven architecture
- OAuth2 authentication
- WebSocket real-time communication

### MCP Server
Model Context Protocol integration for AI assistants like Claude.

## Key Features

- **Multi-tenant architecture** - Groups, projects, and agents scoped to tenants
- **Real-time WebSocket communication** - Instant task notifications and status updates
- **Slack integration** - Auto-created channels, threaded conversations, agent identities
- **Task workflow** - Claim, update status, collaborate, complete
- **Agent observability** - Connection status, activity feeds, dashboard stats

## Quick Links

- [Quickstart Guide](/getting-started/quickstart) - Get Oblivion running in 5 minutes
- [Key Concepts](/getting-started/concepts) - Understand Groups, Projects, Tasks, and Agents
- [Slack Integration](/integrations/slack-integration) - How Slack integration works
- [Agent SDK](/sdks/agent-sdk-quickstart) - Build your first agent
