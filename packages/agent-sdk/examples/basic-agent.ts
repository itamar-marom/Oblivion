/**
 * Basic Agent Example
 *
 * This example demonstrates how to create a simple agent that:
 * 1. Connects to Nexus
 * 2. Listens for available tasks
 * 3. Claims and processes tasks
 * 4. Responds to Slack messages
 *
 * Usage:
 *   NEXUS_URL=http://localhost:3000 \
 *   CLIENT_ID=my-agent \
 *   CLIENT_SECRET=my-secret \
 *   npx ts-node examples/basic-agent.ts
 */

import { OblivionAgent } from '../src/index.js';

// Configuration from environment
const config = {
  nexusUrl: process.env.NEXUS_URL || 'http://localhost:3000',
  clientId: process.env.CLIENT_ID || 'example-agent',
  clientSecret: process.env.CLIENT_SECRET || 'example-secret',
  capabilities: ['code', 'review'],
};

async function main() {
  console.log('Starting example agent...');
  console.log(`Connecting to: ${config.nexusUrl}`);

  const agent = new OblivionAgent(config);

  // Handle connection events
  agent.on('connected', () => {
    console.log('Connected to Nexus!');
  });

  agent.on('disconnected', () => {
    console.log('Disconnected from Nexus');
  });

  agent.on('reconnecting', () => {
    console.log('Reconnecting...');
  });

  agent.on('error', (error) => {
    console.error('Agent error:', error);
  });

  // Handle task events
  agent.on('task_available', async (task) => {
    console.log('New task available:', {
      taskId: task.taskId,
      title: task.title,
      priority: task.priority,
      project: task.projectName,
    });

    // Auto-claim the task (in production, you might want more logic here)
    try {
      const result = await agent.claimTask(task.taskId);
      if (result.success) {
        console.log('Successfully claimed task:', task.taskId);
        await agent.updateTaskStatus(task.taskId, 'IN_PROGRESS');
      } else {
        console.log('Failed to claim task:', result.error);
      }
    } catch (error) {
      console.error('Error claiming task:', error);
    }
  });

  agent.on('task_claimed', (event) => {
    console.log('Task claimed by another agent:', {
      taskId: event.taskId,
      claimedBy: event.claimedByAgentName,
    });
  });

  // Handle Slack messages
  agent.on('slack_message', async (msg) => {
    console.log('Slack message received:', {
      text: msg.text,
      user: msg.user,
      channel: msg.channelId,
      taskId: msg.taskId,
    });

    // Reply to messages mentioning the agent
    if (msg.taskId && msg.text.toLowerCase().includes('hello')) {
      try {
        await agent.postToSlack(msg.taskId, 'Hello! I received your message.');
        console.log('Replied to Slack message');
      } catch (error) {
        console.error('Error replying to Slack:', error);
      }
    }
  });

  // Handle context updates (thread messages)
  agent.on('context_update', (ctx) => {
    console.log('Context update:', {
      taskId: ctx.taskId,
      author: ctx.author,
      content: ctx.content,
    });
  });

  // Connect to Nexus
  try {
    await agent.connect();

    // List available tasks on startup
    const tasks = await agent.listAvailableTasks();
    console.log(`Found ${tasks.length} available tasks`);

    // Keep the agent running
    console.log('Agent is running. Press Ctrl+C to exit.');

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('Shutting down...');
      agent.disconnect();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('Shutting down...');
      agent.disconnect();
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to connect:', error);
    process.exit(1);
  }
}

main().catch(console.error);
