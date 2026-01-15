# Slack Events API Setup Guide

## Overview

Slack Events API is **already implemented** in Oblivion! The webhook endpoint exists and broadcasts events to agents in real-time.

**What you get:**

- ⚡ Real-time push notifications (no polling!)
- 🚀 Unlimited event receives (no rate limits)
- 👥 Agents instantly notified when humans post in Slack
- 📊 Scales to unlimited agents

## Current Implementation

✅ **Webhook Endpoint:** `POST /webhooks/slack` (apps/nexus/src/webhooks/webhooks.controller.ts:123)
✅ **Event Processing:** webhook.processor.ts handles message events
✅ **WebSocket Broadcasting:** Agents receive SLACK_MESSAGE events
✅ **Signature Verification:** Validates Slack signatures
✅ **Bot Message Filtering:** Prevents infinite loops

**Supported Events:**

- `message.channels` - Messages in public channels
- `message.groups` - Messages in private channels
- `app_mention` - @bot mentions

## Configuration Required

### Step 1: Expose Nexus Publicly

Slack needs to reach your webhook endpoint. For local development, use **ngrok**:

```bash
# Install ngrok
brew install ngrok

# Forward port 3000
ngrok http 3000
```

You'll get a URL like: `https://abc123.ngrok.io`

### Step 2: Configure Slack App

1. Go to <https://api.slack.com/apps>
2. Select your Oblivion app
3. Navigate to **Event Subscriptions**

#### Enable Events

- Toggle "Enable Events" to **ON**
- Request URL: `https://abc123.ngrok.io/webhooks/slack`
- Slack will send a challenge request - Oblivion handles this automatically ✅
- Wait for "Verified ✓" status

#### Subscribe to Bot Events

Click "Subscribe to bot events" and add:

- `message.channels` - Listen to messages in public channels
- `message.groups` - Listen to messages in private channels
- `app_mention` - Listen to @bot mentions

#### Save Changes

- Click "Save Changes" at bottom
- **Reinstall app to workspace** (yellow banner will appear)

### Step 3: Verify Required Scopes

Go to **OAuth & Permissions** and verify these scopes exist:

- `channels:history` ✅ (already have)
- `groups:history` ✅ (already have)
- `app_mentions:read` ✅ (should be auto-added with events)
- `chat:write` ✅ (already have)
- `chat:write.customize` ✅ (already have)

### Step 4: Test the Integration

#### Test 1: Send a Test Message

1. Post a message in `#oblivion-infra_task-integration` channel
2. Check Nexus logs for:

   ```
   Slack webhook received: message (team: T...)
   Queued Slack job: slack-...
   Processing slack:message (id: ...)
   Broadcasting SLACK_MESSAGE to N agents in group "Infra"
   ```

#### Test 2: Verify Agent Receives Event

If you have an agent connected via WebSocket, they should receive:

```json
{
  "type": "slack_message",
  "payload": {
    "channelId": "C...",
    "messageTs": "1768...",
    "text": "Hello from Slack!",
    "user": "U...",
    "projectId": "...",
    "projectName": "Task Integration",
    "groupId": "...",
    "groupName": "Infra"
  },
  "timestamp": "2026-01-11T..."
}
```

#### Test 3: Thread Messages

1. Post in a task thread
2. Agent receives SLACK_MESSAGE event
3. Message also syncs to ClickUp (if task exists)
4. Agent also receives CONTEXT_UPDATE event (for backward compatibility)

## How Agents Use This

### Example: Auto-Respond to Mentions

```typescript
// In your autonomous agent
socket.on('SLACK_MESSAGE', async (event) => {
  const { text, taskId, user } = event.payload;

  // Check if bot was mentioned
  if (text.includes('@KAgent')) {
    // Fetch task context
    const context = await getTaskContext(taskId);

    // Generate response
    const response = await processRequest(text, context);

    // Post to Slack
    await postToSlack(taskId, response);
  }
});
```

### Example: Monitor Channel Activity

```typescript
socket.on('SLACK_MESSAGE', (event) => {
  console.log(`New message in ${event.payload.projectName}`);
  console.log(`From: ${event.payload.user}`);
  console.log(`Text: ${event.payload.text}`);

  // Decide if this agent should respond
  if (shouldRespond(event.payload.text)) {
    queueResponse(event);
  }
});
```

## Architecture Flow

```
1. Human posts in Slack channel
   ↓
2. Slack pushes event to https://your-domain/webhooks/slack
   ↓
3. WebhooksController validates signature, queues job
   ↓
4. WebhookProcessor processes job from queue
   ↓
5. Finds project/group from channelId
   ↓
6. Broadcasts SLACK_MESSAGE event to all agents in group
   ↓
7. Agents receive event via WebSocket (instant!)
   ↓
8. Agents can respond if needed
```

## Troubleshooting

### "Endpoint not found" during URL verification

- Make sure Nexus is running and accessible via ngrok
- Check ngrok URL is correct: `https://abc123.ngrok.io/webhooks/slack` (no trailing slash)
- Check Nexus logs for incoming requests

### Events not arriving

- Verify bot is invited to the channel (Slack won't send events from channels bot isn't in)
- Check Slack app is installed to workspace
- Check Event Subscriptions shows "Verified ✓"
- Look for errors in Nexus logs

### Agents not receiving events

- Verify agent is connected to WebSocket
- Check agent is in the group that owns the channel
- Look for "Broadcasting SLACK_MESSAGE" in Nexus logs
- Verify agent is listening for SLACK_MESSAGE event type

## Rate Limits

**Event Receives:** Unlimited ✅ (Slack pushes to you)
**Event Processing:** No rate limits (it's your server)
**API Calls (posting responses):** Still subject to Slack API limits

**Best practice:** Only call Slack API when necessary (to post responses). All receives are free and instant!

## Next Steps

Once Events API is configured:

1. **Build autonomous agents** that listen for SLACK_MESSAGE events
2. **Respond to @mentions** automatically
3. **Monitor channel activity** without polling
4. **Collaborate in real-time** - humans + agents together in Slack

The infrastructure is ready - just needs Slack app configuration!
