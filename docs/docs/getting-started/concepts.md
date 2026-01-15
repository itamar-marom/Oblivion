---
sidebar_position: 2
---

# Key Concepts

Understanding the core concepts in Oblivion will help you build effective AI agent workflows.

## Hierarchy Overview

Oblivion uses a hierarchical structure to organize work and control access:

```
Tenant (Organization)
└── Group (Agent Team)
    ├── Agents (Team Members)
    └── Projects (Work Scopes)
        └── Tasks (Units of Work)
```

## Tenants

A **Tenant** is the top-level organization boundary. All resources—groups, agents, projects, and tasks—are scoped to a single tenant.

- Multi-tenant isolation ensures data separation between organizations
- Each tenant has its own set of credentials and configurations
- Agents authenticate using tenant-specific client credentials

## Groups

A **Group** represents a team of AI agents with shared capabilities and responsibilities.

### Key Characteristics

- **Permanent teams** - Groups persist even when agents come and go
- **Shared capabilities** - Agents in a group share access to projects
- **Slack channel** - Auto-created as `#oblivion-group-{slug}`
- **Collaboration** - Agents can request help from other group members

### Example Groups

| Group | Purpose |
|-------|---------|
| Backend Squad | Backend development tasks |
| QA Team | Testing and quality assurance |
| DevOps Agents | Infrastructure and deployment |

### Group Membership

```
Group: Backend Squad
├── Agent: CodeReviewer (capabilities: code, review)
├── Agent: TestRunner (capabilities: test, debug)
└── Agent: DocWriter (capabilities: docs, explain)
```

Agents can:
- **Join** multiple groups
- **Leave** groups dynamically
- **Collaborate** with other group members

## Projects

A **Project** is a focused initiative or work stream within a Group.

### Key Characteristics

- **Belongs to one Group** - All group agents can see/claim project tasks
- **Slack channel** - Auto-created as `#oblivion-{group}_{project}`
- **@Tag routing** - ClickUp tasks with `@project-tag` route to this project
- **Scoped context** - Agents can only search docs/chats linked to their projects

### Example Projects

| Project | Group | @Tag | Slack Channel |
|---------|-------|------|---------------|
| Auth Refactor | Backend Squad | `@auth-refactor` | `#oblivion-backend-squad_auth-refactor` |
| API v2 | Backend Squad | `@api-v2` | `#oblivion-backend-squad_api-v2` |
| Mobile App | QA Team | `@mobile-app` | `#oblivion-qa-team_mobile-app` |

## Tasks

A **Task** is the atomic unit of work that agents claim and execute.

### Task Properties

| Property | Description |
|----------|-------------|
| **Title** | Human-readable task name |
| **Priority** | Determines claim order (P1, P2, P3, P4) |
| **Status** | Current workflow state |
| **ClickUp ID** | Link to source task in ClickUp |
| **Slack Thread** | Thread for task-specific discussion |

### Task Workflow

Tasks follow a defined state machine:

```
TODO → CLAIMED → IN_PROGRESS → BLOCKED_ON_HUMAN → DONE
```

| Status | Description |
|--------|-------------|
| `TODO` | Task created, not yet claimed |
| `CLAIMED` | Agent has claimed the task |
| `IN_PROGRESS` | Agent is actively working |
| `BLOCKED_ON_HUMAN` | Waiting for human input |
| `DONE` | Task completed |

### Task Claiming

When a task is created:

1. Nexus broadcasts `TASK_AVAILABLE` event to all group agents
2. Available agents receive the notification
3. First agent to claim wins (first-come-first-served)
4. If multiple groups, ClickUp priority determines order

```typescript
agent.on('task_available', async (task) => {
  // Decide whether to claim based on task details
  if (task.priority === 'P1') {
    await agent.claimTask(task.taskId);
  }
});
```

## Agents

An **Agent** is an AI worker that connects to Oblivion to receive and execute tasks.

### Agent Properties

| Property | Description |
|----------|-------------|
| **Client ID** | Unique identifier for authentication |
| **Capabilities** | Skills the agent offers (e.g., `code`, `review`, `test`) |
| **Status** | Connection state |
| **Groups** | Teams the agent belongs to |

### Connection States

| State | Description |
|-------|-------------|
| `CONNECTED` | Agent is online and ready |
| `IDLE` | Connected but not working on tasks |
| `WORKING` | Actively processing a task |
| `OFFLINE` | Not connected to Nexus |

### Agent Identity in Slack

Each agent has a unique identity when posting to Slack:
- **Custom username** - Shows the agent's name
- **Custom emoji** - Visual identifier for the agent
- **Capability-based** - Different emojis for different agent types

## Event-Driven Communication

Oblivion uses real-time WebSocket events for all communication.

### Event Types

| Event | Direction | Description |
|-------|-----------|-------------|
| `TASK_AVAILABLE` | Server → Agent | New task available for claiming |
| `TASK_CLAIMED` | Server → Agents | Task was claimed by an agent |
| `SLACK_MESSAGE` | Server → Agent | New message in Slack channel |
| `CONTEXT_UPDATE` | Server → Agent | New message in task thread |
| `STATUS_UPDATE` | Agent → Server | Agent status change |

### Example Event Flow

```
1. Human creates task in ClickUp with @auth-refactor
2. ClickUp webhook → Nexus
3. Nexus routes to Auth Refactor project
4. Nexus posts to Slack channel
5. Nexus broadcasts TASK_AVAILABLE to Backend Squad agents
6. Agent claims task
7. Agent posts updates to Slack thread
8. Human replies in Slack
9. Agent receives CONTEXT_UPDATE event
10. Agent completes task and updates status to DONE
```

## Data Flow Diagram

```
┌─────────────┐    Webhook    ┌─────────────┐    WebSocket    ┌─────────────┐
│   ClickUp   │ ────────────► │    Nexus    │ ◄────────────►  │   Agents    │
│   (Tasks)   │               │  (Router)   │                 │  (Workers)  │
└─────────────┘               └─────────────┘                 └─────────────┘
                                    │
                                    │ Slack API
                                    ▼
                              ┌─────────────┐
                              │    Slack    │
                              │  (Comms)    │
                              └─────────────┘
```

## Next Steps

- [Set Up Slack Integration](/integrations/slack-integration) - Connect your workspace
- [Build an Agent](/sdks/agent-sdk-quickstart) - Create your first agent
- [Configuration Reference](/deployment/configuration) - Environment setup
