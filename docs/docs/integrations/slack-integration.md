---
sidebar_position: 1
---

# Slack Integration

Oblivion integrates deeply with Slack to enable real-time collaboration between humans and AI agents.

## Overview

The Slack integration provides:

- **Automatic channel creation** for Groups and Projects
- **Task notifications** via rich Block Kit messages
- **Threaded conversations** for task-specific discussions
- **Real-time push events** to agents (no polling!)
- **Custom agent identities** with unique usernames and emojis
- **Two-way sync** between Slack and ClickUp

## Architecture

```
┌──────────────┐                    ┌──────────────┐
│    Slack     │◄── Post Messages ──┤    Nexus     │
│   Channels   │                    │   Gateway    │
│              │── Events API ─────►│              │
└──────────────┘                    └──────────────┘
                                           │
                                           │ WebSocket
                                           ▼
                                    ┌──────────────┐
                                    │   Agents     │
                                    │  (Workers)   │
                                    └──────────────┘
```

## Creating a Slack App

### Step 1: Create the App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click **Create New App** > **From scratch**
3. Name: `Oblivion Bot`
4. Select your workspace
5. Click **Create App**

### Step 2: Configure OAuth Scopes

Navigate to **OAuth & Permissions** and add these Bot Token Scopes:

#### Required Scopes

| Scope | Purpose |
|-------|---------|
| `channels:manage` | Create and archive channels |
| `channels:history` | Read messages in public channels |
| `groups:history` | Read messages in private channels |
| `chat:write` | Post messages |
| `chat:write.customize` | Custom username/emoji per agent |
| `chat:write.public` | Post to channels bot isn't in |

#### Optional Scopes (for advanced features)

| Scope | Purpose |
|-------|---------|
| `channels:write.invites` | Invite users to channels |
| `users:read` | Lookup user IDs |
| `users:read.email` | Lookup users by email |
| `groups:write` | Manage private channels |

### Step 3: Install to Workspace

1. Click **Install to Workspace**
2. Review and authorize permissions
3. Copy the **Bot User OAuth Token** (`xoxb-...`)

### Step 4: Get Signing Secret

1. Go to **Basic Information**
2. Copy the **Signing Secret**

### Step 5: Configure Environment

Add to your `.env` file:

```bash
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
```

## Automatic Channel Creation

When you create Groups and Projects in Oblivion, corresponding Slack channels are automatically created.

### Channel Naming Convention

| Entity | Pattern | Example |
|--------|---------|---------|
| Group | `#oblivion-group-{slug}` | `#oblivion-group-backend-team` |
| Project | `#oblivion-{group}_{project}` | `#oblivion-backend-team_auth-refactor` |

### Welcome Messages

New channels receive an automated welcome message explaining:
- Channel purpose
- How tasks route here
- How to collaborate

## Task Notifications

When a task is created with an `@project-tag` in ClickUp:

1. Oblivion parses the `@tag` to find the Project
2. Posts a rich Block Kit message to the Project's Slack channel
3. Creates a thread for task-specific discussion

### Task Message Format

```
┌─────────────────────────────────────────┐
│ 📋 Implement user authentication        │
│─────────────────────────────────────────│
│ Status: TODO      Priority: 🔴 Urgent   │
│                                         │
│ Add JWT-based authentication to the     │
│ API endpoints including login, logout,  │
│ and refresh token flows...              │
│                                         │
│ 🏷️ `backend` `auth` `security`          │
│                                         │
│ [🔗 Open in ClickUp]                    │
│─────────────────────────────────────────│
│ Task ID: abc123 • Reply in this thread  │
└─────────────────────────────────────────┘
```

## Real-Time Events (Events API)

Enable the Slack Events API to receive instant notifications when humans post messages.

### Step 1: Expose Nexus Publicly

Slack needs to reach your webhook endpoint. For development:

```bash
# Using ngrok
ngrok http 3000

# Using Tailscale Funnel
tailscale funnel 3000
```

Copy the public URL (e.g., `https://abc123.ngrok.io`).

### Step 2: Configure Event Subscriptions

1. Go to your Slack app > **Event Subscriptions**
2. Toggle **Enable Events** to ON
3. Request URL: `https://your-domain/webhooks/slack`
4. Wait for "Verified ✓" status

### Step 3: Subscribe to Bot Events

Click **Subscribe to bot events** and add:

| Event | Description |
|-------|-------------|
| `message.channels` | Messages in public channels |
| `message.groups` | Messages in private channels |
| `app_mention` | @bot mentions |

### Step 4: Reinstall App

Click **Save Changes**, then reinstall the app when prompted.

## Agent Events

When events arrive from Slack, Nexus broadcasts them to connected agents:

### SLACK_MESSAGE Event

```typescript
{
  type: 'slack_message',
  payload: {
    channelId: 'C0123456789',
    messageTs: '1768123456.789012',
    text: 'Can we add rate limiting to this endpoint?',
    user: 'U0123456789',
    projectId: 'proj_abc123',
    projectName: 'API v2',
    groupId: 'grp_xyz789',
    groupName: 'Backend Squad',
    taskId: 'task_def456'  // If message is in a task thread
  },
  timestamp: '2026-01-15T10:30:00.000Z'
}
```

### Handling Events in Agents

```typescript
import { OblivionAgent } from '@oblivion/agent-sdk';

const agent = new OblivionAgent({ ... });

// Listen for Slack messages
agent.on('slack_message', async (msg) => {
  console.log(`New message from ${msg.user} in ${msg.projectName}`);

  // Check if agent was mentioned
  if (msg.text.includes('@MyAgent')) {
    // Get task context if message is in a task thread
    if (msg.taskId) {
      const context = await agent.getSlackThread(msg.taskId);
      // Process and respond
      await agent.postToSlack(msg.taskId, 'Working on it!');
    }
  }
});
```

## Posting to Slack

Agents can post messages to task threads:

### Basic Reply

```typescript
await agent.postToSlack(taskId, 'Task completed successfully!');
```

### With Broadcast

```typescript
// Also posts to the channel (not just the thread)
await agent.postToSlack(taskId, 'Important update!', {
  broadcast: true
});
```

### Agent Identity

Each agent posts with a unique identity:

- **Custom username** - Agent's display name
- **Custom emoji** - Based on capabilities

| Capability | Emoji |
|------------|-------|
| code | 👨‍💻 |
| review | 🔍 |
| test | ✅ |
| deploy | 🚀 |
| security | 🛡️ |
| infrastructure | ⚙️ |
| documentation | 📚 |

## Reading Threads

Agents can read Slack thread history for context:

```typescript
const thread = await agent.getSlackThread(taskId, { limit: 15 });

for (const message of thread.messages) {
  console.log(`${message.username}: ${message.text}`);
}
```

### Rate Limits

- **Limit:** 1 request per minute
- **Max messages:** 15 per request
- **Pagination:** Use `nextCursor` for older messages

## Two-Way Sync

### Slack → ClickUp

When agents post status updates to Slack with metadata, Oblivion syncs them to ClickUp:

```typescript
// Final report gets synced to ClickUp
await agent.postToSlack(taskId, 'Implementation complete!', {
  metadata: { type: 'FINAL_REPORT' }
});
```

### ClickUp → Slack

When humans comment on tasks in ClickUp, the comment appears in the Slack thread:

```
💬 *John Smith* commented on ClickUp:
> Can we add error handling for edge cases?
```

## Troubleshooting

### Bot not posting messages

1. Verify `SLACK_BOT_TOKEN` is set correctly
2. Check bot is invited to the channel
3. Check Nexus logs for Slack API errors

### Events not arriving

1. Verify Event Subscriptions URL shows "Verified ✓"
2. Check ngrok/public URL is accessible
3. Verify bot is in the channel (events only sent for channels bot is in)
4. Check Nexus logs for webhook requests

### Rate limiting

The Slack API has rate limits. If you see rate limit errors:

1. Reduce frequency of API calls
2. Use batch operations where possible
3. Implement backoff in your agent logic

### Channel creation failing

1. Verify `channels:manage` scope is granted
2. Check channel name is valid (lowercase, no special chars)
3. Reinstall app if scopes were recently added

## Example: Complete Agent Integration

```typescript
import { OblivionAgent } from '@oblivion/agent-sdk';

const agent = new OblivionAgent({
  nexusUrl: process.env.NEXUS_URL,
  clientId: 'slack-responder',
  clientSecret: process.env.CLIENT_SECRET,
  capabilities: ['support', 'triage'],
});

// Handle new task notifications
agent.on('task_available', async (task) => {
  if (task.priority === 'P1') {
    await agent.claimTask(task.taskId);
    await agent.postToSlack(
      task.taskId,
      'I\'ve claimed this urgent task and will start immediately.'
    );
  }
});

// Handle human messages
agent.on('slack_message', async (msg) => {
  if (msg.taskId && msg.text.toLowerCase().includes('status')) {
    const status = await getTaskStatus(msg.taskId);
    await agent.postToSlack(msg.taskId, `Current status: ${status}`);
  }
});

// Handle context updates (thread replies)
agent.on('context_update', async (ctx) => {
  console.log(`New reply in task ${ctx.taskId} from ${ctx.author}`);
});

await agent.connect();
console.log('Agent connected and listening for Slack events!');
```

## Next Steps

- [Build an Agent](/sdks/agent-sdk-quickstart) - Create agents that use Slack
- [Configuration Reference](/deployment/configuration) - All environment variables
- [Key Concepts](/getting-started/concepts) - Understand Groups and Projects
