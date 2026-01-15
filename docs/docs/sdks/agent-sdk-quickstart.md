---
sidebar_position: 1
---

# Agent SDK Quickstart

Build your first Oblivion agent in under 50 lines of code.

## Installation

```bash
# Using pnpm
pnpm add @oblivion/agent-sdk

# Using npm
npm install @oblivion/agent-sdk

# Using yarn
yarn add @oblivion/agent-sdk
```

## Quick Start

```typescript
import { OblivionAgent } from '@oblivion/agent-sdk';

const agent = new OblivionAgent({
  nexusUrl: 'http://localhost:3000',
  clientId: 'my-agent',
  clientSecret: 'your-secret',
  capabilities: ['code', 'review'],
});

// Listen for new tasks
agent.on('task_available', async (task) => {
  console.log('New task:', task.title);
  await agent.claimTask(task.taskId);
  await agent.updateTaskStatus(task.taskId, 'IN_PROGRESS');
});

// Listen for Slack messages
agent.on('slack_message', async (msg) => {
  if (msg.taskId && msg.text.includes('@MyAgent')) {
    await agent.postToSlack(msg.taskId, 'Hello! I received your message.');
  }
});

// Connect and start receiving events
await agent.connect();
```

## Configuration

```typescript
interface AgentConfig {
  // Required
  nexusUrl: string;         // Nexus server URL
  clientId: string;         // OAuth2 client ID
  clientSecret: string;     // OAuth2 client secret

  // Optional
  capabilities?: string[];  // Agent capabilities (e.g., ['code', 'review'])
  version?: string;         // SDK version to report
  debug?: boolean;          // Enable debug logging
  autoReconnect?: boolean;  // Auto-reconnect on disconnect (default: true)
  maxReconnectAttempts?: number;  // Max reconnect attempts (default: 10)
  reconnectDelay?: number;  // Initial reconnect delay in ms (default: 1000)
}
```

## Event Handling

### Connection Events

```typescript
agent.on('connected', () => {
  console.log('WebSocket connected');
});

agent.on('disconnected', () => {
  console.log('WebSocket disconnected');
});

agent.on('reconnecting', () => {
  console.log('Attempting to reconnect...');
});

agent.on('error', (error) => {
  console.error('Error:', error);
});
```

### Task Events

```typescript
// New task available for claiming
agent.on('task_available', async (task) => {
  console.log('Task:', task.taskId, task.title);
  console.log('Priority:', task.priority);
  console.log('Project:', task.projectName);
});

// Task was claimed by another agent
agent.on('task_claimed', (event) => {
  console.log('Task claimed:', event.taskId);
  console.log('By agent:', event.claimedByAgentName);
});
```

### Slack Events

```typescript
// New message in Slack channel
agent.on('slack_message', async (msg) => {
  console.log('Message from:', msg.user);
  console.log('In project:', msg.projectName);
  console.log('Text:', msg.text);

  if (msg.taskId) {
    console.log('In task thread:', msg.taskId);
  }
});

// Thread message in task context
agent.on('context_update', async (ctx) => {
  console.log('Context update for task:', ctx.taskId);
  console.log('Author:', ctx.author);
  console.log('Content:', ctx.content);
});
```

## Task Operations

### List Tasks

```typescript
// Get available (unclaimed) tasks
const available = await agent.listAvailableTasks();
console.log(`${available.length} tasks available`);

// Get your claimed tasks
const claimed = await agent.listClaimedTasks();
console.log(`Working on ${claimed.length} tasks`);
```

### Claim a Task

```typescript
agent.on('task_available', async (task) => {
  // Decide whether to claim based on priority or capabilities
  if (task.priority === 'P1') {
    const result = await agent.claimTask(task.taskId);
    if (result.success) {
      console.log('Task claimed successfully');
    }
  }
});
```

### Update Task Status

```typescript
// Mark task as in progress
await agent.updateTaskStatus(taskId, 'IN_PROGRESS');

// Mark as blocked (waiting for human)
await agent.updateTaskStatus(taskId, 'BLOCKED_ON_HUMAN');

// Mark as complete
await agent.updateTaskStatus(taskId, 'DONE');
```

### Get Task Details

```typescript
// By internal task ID
const task = await agent.getTaskById(taskId);

// By ClickUp task ID
const task = await agent.getTask(clickupTaskId);
```

## Slack Operations

### Post to Thread

```typescript
// Simple message
await agent.postToSlack(taskId, 'Working on this now!');

// With broadcast to channel
await agent.postToSlack(taskId, 'Important update!', {
  broadcast: true
});
```

### Read Thread History

```typescript
const thread = await agent.getSlackThread(taskId, { limit: 10 });

for (const message of thread.messages) {
  console.log(`${message.username}: ${message.text}`);
}

// Paginate for more messages
if (thread.hasMore) {
  const more = await agent.getSlackThread(taskId, {
    cursor: thread.nextCursor
  });
}
```

## Status Updates

Keep the dashboard informed of your agent's state:

```typescript
// Working on a task
agent.sendStatusUpdate('working', taskId, 'Processing data...');

// Idle and waiting
agent.sendStatusUpdate('idle');

// Error state
agent.sendStatusUpdate('error', undefined, 'Database connection failed');
```

## Error Handling

The SDK provides typed errors for different failure modes:

```typescript
import {
  OblivionError,
  AuthError,
  ApiError,
  ConnectionError,
  ConfigError,
  TaskError,
  TimeoutError,
} from '@oblivion/agent-sdk';

try {
  await agent.connect();
} catch (error) {
  if (error instanceof AuthError) {
    console.error('Authentication failed:', error.statusCode);
  } else if (error instanceof ConnectionError) {
    console.error('Connection failed:', error.reason);
  } else if (error instanceof TimeoutError) {
    console.error('Request timed out:', error.timeoutMs, 'ms');
  }
}
```

## Crash Recovery

Agents are stateless. If your agent crashes while working on a task:

1. Restart the agent process
2. The task remains `CLAIMED` to your agent
3. Call `listClaimedTasks()` to resume work on any in-progress tasks

```typescript
// On startup, check for previously claimed tasks
const claimed = await agent.listClaimedTasks();
for (const task of claimed) {
  console.log(`Resuming task: ${task.title}`);
  // Resume your work...
}
```

## Debug Logging

Enable verbose logging for troubleshooting:

```bash
# All Oblivion logs
DEBUG=oblivion:* node my-agent.js

# Specific namespaces
DEBUG=oblivion:socket,oblivion:auth node my-agent.js
```

Available namespaces:
- `oblivion:auth` - Authentication/token refresh
- `oblivion:socket` - WebSocket connection
- `oblivion:http` - REST API calls
- `oblivion:client` - Main client operations

## Complete Example

Here's a full agent that processes code review tasks:

```typescript
import { OblivionAgent, TaskError } from '@oblivion/agent-sdk';

async function main() {
  const agent = new OblivionAgent({
    nexusUrl: process.env.NEXUS_URL || 'http://localhost:3000',
    clientId: 'code-reviewer',
    clientSecret: process.env.CLIENT_SECRET!,
    capabilities: ['code', 'review'],
    debug: process.env.DEBUG === 'true',
  });

  // Handle new tasks
  agent.on('task_available', async (task) => {
    console.log(`New task available: ${task.title}`);

    // Only claim code review tasks
    if (!task.title.toLowerCase().includes('review')) {
      return;
    }

    try {
      await agent.claimTask(task.taskId);
      await agent.updateTaskStatus(task.taskId, 'IN_PROGRESS');
      await agent.postToSlack(task.taskId, 'Starting code review...');

      // Simulate review process
      const result = await performCodeReview(task);

      await agent.postToSlack(task.taskId, result.summary);
      await agent.updateTaskStatus(task.taskId, 'DONE');
    } catch (error) {
      if (error instanceof TaskError) {
        console.error('Task operation failed:', error.message);
      }
      await agent.updateTaskStatus(task.taskId, 'BLOCKED_ON_HUMAN');
    }
  });

  // Handle questions from humans
  agent.on('slack_message', async (msg) => {
    if (msg.taskId && msg.text.includes('?')) {
      await agent.postToSlack(
        msg.taskId,
        'Let me look into that question...'
      );
    }
  });

  // Handle errors
  agent.on('error', (error) => {
    console.error('Agent error:', error);
  });

  // Connect
  await agent.connect();
  console.log('Code Reviewer agent is running!');
}

async function performCodeReview(task: any): Promise<{ summary: string }> {
  // Your code review logic here
  return { summary: 'Code review complete. No issues found.' };
}

main().catch(console.error);
```

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import type {
  AgentConfig,
  Task,
  AvailableTask,
  TaskAvailablePayload,
  SlackMessagePayload,
  ConnectionState,
} from '@oblivion/agent-sdk';
```

## Next Steps

- [Slack Integration](/integrations/slack-integration) - Learn about Slack events
- [Key Concepts](/getting-started/concepts) - Understand the data model
- [Configuration Reference](/deployment/configuration) - Environment setup
