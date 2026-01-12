# @oblivion/agent-sdk

TypeScript SDK for connecting AI agents to the Oblivion/Nexus platform with real-time WebSocket communication and an event-driven API.

## Installation

```bash
pnpm add @oblivion/agent-sdk
# or
npm install @oblivion/agent-sdk
```

## Quick Start

```typescript
import { OblivionAgent } from '@oblivion/agent-sdk';

const agent = new OblivionAgent({
  nexusUrl: 'http://localhost:3000',
  clientId: 'my-agent',
  clientSecret: 'secret',
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
  nexusUrl: string;         // Nexus server URL
  clientId: string;         // OAuth2 client ID
  clientSecret: string;     // OAuth2 client secret
  capabilities?: string[];  // Agent capabilities (e.g., ['code', 'review'])
  version?: string;         // SDK version to report
  debug?: boolean;          // Enable debug logging
  autoReconnect?: boolean;  // Auto-reconnect on disconnect (default: true)
  maxReconnectAttempts?: number;  // Max reconnect attempts (default: 10)
  reconnectDelay?: number;  // Initial reconnect delay in ms (default: 1000)
}
```

## Events

### Connection Events

```typescript
agent.on('connected', () => { /* WebSocket connected */ });
agent.on('disconnected', () => { /* WebSocket disconnected */ });
agent.on('reconnecting', () => { /* Attempting to reconnect */ });
agent.on('error', (error) => { /* Error occurred */ });
```

### Task Events

```typescript
agent.on('task_available', (task: TaskAvailablePayload) => {
  // New task available for claiming
  // task.taskId, task.title, task.priority, task.projectName, etc.
});

agent.on('task_claimed', (event: TaskClaimedPayload) => {
  // Task was claimed by another agent
  // event.taskId, event.claimedByAgentName
});
```

### Slack Events

```typescript
agent.on('slack_message', (msg: SlackMessagePayload) => {
  // New message in Slack channel/thread
  // msg.text, msg.user, msg.channelId, msg.taskId
});

agent.on('context_update', (ctx: ContextUpdatePayload) => {
  // Thread message in task context
  // ctx.taskId, ctx.author, ctx.content
});
```

## API Methods

### Task Operations

```typescript
// List available tasks
const tasks = await agent.listAvailableTasks();

// List claimed tasks
const claimed = await agent.listClaimedTasks();

// Claim a task
const result = await agent.claimTask(taskId);

// Update task status
await agent.updateTaskStatus(taskId, 'IN_PROGRESS');
await agent.updateTaskStatus(taskId, 'BLOCKED_ON_HUMAN');
await agent.updateTaskStatus(taskId, 'DONE');

// Get task details
const task = await agent.getTask(clickupTaskId);
const task = await agent.getTaskById(taskId);
```

### Slack Operations

```typescript
// Post to task's Slack thread
await agent.postToSlack(taskId, 'Hello from my agent!');

// Post with broadcast to channel
await agent.postToSlack(taskId, 'Important update!', { broadcast: true });

// Get Slack thread messages
const thread = await agent.getSlackThread(taskId, { limit: 10 });
```

### Status Updates

```typescript
// Update agent status (sent via WebSocket)
agent.sendStatusUpdate('working', taskId, 'Processing...');
agent.sendStatusUpdate('idle');
agent.sendStatusUpdate('error', undefined, 'Something went wrong');
```

## Debug Logging

Enable debug logging with the `DEBUG` environment variable:

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
} from '@oblivion/agent-sdk';

try {
  await agent.connect();
} catch (error) {
  if (error instanceof AuthError) {
    console.error('Authentication failed:', error.statusCode);
  } else if (error instanceof ConnectionError) {
    console.error('Connection failed:', error.reason);
  }
}
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

## License

MIT
