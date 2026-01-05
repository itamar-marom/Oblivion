import { PrismaClient, TaskStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import { WebClient } from '@slack/web-api';
import 'dotenv/config';

// Slack client for channel creation
const slackToken = process.env.SLACK_BOT_TOKEN;
const slack = slackToken ? new WebClient(slackToken) : null;

/**
 * Create or find a Slack channel by name.
 * Returns the channel ID or null if Slack is not configured.
 */
async function createOrFindSlackChannel(name: string): Promise<string | null> {
  if (!slack) {
    console.log(`  ⚠️  Slack not configured, skipping channel: ${name}`);
    return null;
  }

  // Sanitize channel name
  const sanitizedName = name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '')
    .substring(0, 80);

  try {
    // Try to create the channel
    const result = await slack.conversations.create({
      name: sanitizedName,
      is_private: false,
    });

    if (result.ok && result.channel?.id) {
      console.log(`  ✅ Created Slack channel: #${sanitizedName}`);
      return result.channel.id;
    }
  } catch (error: unknown) {
    const slackError = error as { data?: { error?: string } };
    // Channel already exists - find it
    if (slackError.data?.error === 'name_taken') {
      try {
        let cursor: string | undefined;
        do {
          const list = await slack.conversations.list({
            types: 'public_channel',
            limit: 200,
            cursor,
          });
          const channel = list.channels?.find((c) => c.name === sanitizedName);
          if (channel?.id) {
            console.log(`  ✅ Found existing Slack channel: #${sanitizedName}`);
            return channel.id;
          }
          cursor = list.response_metadata?.next_cursor;
        } while (cursor);
      } catch {
        console.log(`  ⚠️  Could not find channel: ${sanitizedName}`);
      }
    } else {
      console.log(`  ⚠️  Failed to create channel ${sanitizedName}: ${slackError.data?.error}`);
    }
  }

  return null;
}

// Prisma 7 requires a driver adapter
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  // Clean up existing data (in reverse dependency order)
  await prisma.task.deleteMany();
  await prisma.agentGroupMembership.deleteMany();
  await prisma.project.deleteMany();
  await prisma.group.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.tenant.deleteMany();

  // Create tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Oblivion Dev',
      slug: 'oblivion-dev',
    },
  });
  console.log(`✅ Created tenant: ${tenant.name} (${tenant.id})`);

  // Create agents with known secrets for testing
  // Plain text secrets: test_secret_1, test_secret_2, test_secret_3
  const agents = await Promise.all([
    prisma.agent.create({
      data: {
        tenantId: tenant.id,
        name: 'Backend Agent',
        description: 'Handles backend tasks, APIs, and database work',
        clientId: 'backend-agent',
        clientSecret: await bcrypt.hash('test_secret_1', 10),
        capabilities: ['nodejs', 'python', 'postgresql', 'api'],
        isActive: true,
      },
    }),
    prisma.agent.create({
      data: {
        tenantId: tenant.id,
        name: 'Frontend Agent',
        description: 'Handles UI/UX, React, and frontend work',
        clientId: 'frontend-agent',
        clientSecret: await bcrypt.hash('test_secret_2', 10),
        capabilities: ['react', 'typescript', 'css', 'nextjs'],
        isActive: true,
      },
    }),
    prisma.agent.create({
      data: {
        tenantId: tenant.id,
        name: 'DevOps Agent',
        description: 'Handles CI/CD, infrastructure, and deployments',
        clientId: 'devops-agent',
        clientSecret: await bcrypt.hash('test_secret_3', 10),
        capabilities: ['kubernetes', 'docker', 'terraform', 'github-actions'],
        isActive: true,
      },
    }),
    // Observer Dashboard - special agent for monitoring
    prisma.agent.create({
      data: {
        tenantId: tenant.id,
        name: 'Observer Dashboard',
        description: 'Admin dashboard for monitoring the agent ecosystem',
        clientId: 'observer-dashboard',
        clientSecret: await bcrypt.hash('observer_secret', 10),
        capabilities: ['observe', 'admin'],
        isActive: true,
      },
    }),
    // Claude Code - MCP-based coding agent
    prisma.agent.create({
      data: {
        tenantId: tenant.id,
        name: 'Claude Code',
        description: 'Claude Code MCP integration for task management',
        clientId: 'claude-code-agent',
        clientSecret: await bcrypt.hash('claude_secret', 10),
        capabilities: ['code', 'review', 'documentation', 'refactor', 'testing'],
        isActive: true,
      },
    }),
  ]);
  console.log(`✅ Created ${agents.length} agents`);

  // Create groups with Slack channels
  console.log('\n📢 Creating groups with Slack channels...');

  const backendTeamChannelId = await createOrFindSlackChannel('oblivion-group-backend-team');
  const backendTeam = await prisma.group.create({
    data: {
      tenantId: tenant.id,
      name: 'Backend Team',
      slug: 'backend-team',
      description: 'Handles all backend services and APIs',
      slackChannelId: backendTeamChannelId,
      slackChannelName: '#oblivion-group-backend-team',
      isActive: true,
    },
  });

  const frontendTeamChannelId = await createOrFindSlackChannel('oblivion-group-frontend-team');
  const frontendTeam = await prisma.group.create({
    data: {
      tenantId: tenant.id,
      name: 'Frontend Team',
      slug: 'frontend-team',
      description: 'Handles all UI/UX and frontend applications',
      slackChannelId: frontendTeamChannelId,
      slackChannelName: '#oblivion-group-frontend-team',
      isActive: true,
    },
  });
  console.log(`✅ Created 2 groups`);

  // Create memberships
  await prisma.agentGroupMembership.createMany({
    data: [
      { agentId: agents[0].id, groupId: backendTeam.id, role: 'lead' },
      { agentId: agents[2].id, groupId: backendTeam.id, role: 'member' },
      { agentId: agents[1].id, groupId: frontendTeam.id, role: 'lead' },
      // Claude Code agent is a member of both teams
      { agentId: agents[4].id, groupId: backendTeam.id, role: 'member' },
      { agentId: agents[4].id, groupId: frontendTeam.id, role: 'member' },
    ],
  });
  console.log(`✅ Created 5 group memberships`);

  // Create projects with Slack channels
  console.log('\n📢 Creating projects with Slack channels...');

  const authChannelId = await createOrFindSlackChannel('oblivion-backend-team_auth-refactor');
  const authProject = await prisma.project.create({
    data: {
      groupId: backendTeam.id,
      tenantId: tenant.id,
      name: 'Auth Refactor',
      slug: 'auth-refactor',
      description: 'Refactoring the authentication system to use JWT',
      oblivionTag: 'auth-refactor',
      slackChannelId: authChannelId,
      slackChannelName: '#oblivion-backend-team_auth-refactor',
      isActive: true,
    },
  });

  const apiChannelId = await createOrFindSlackChannel('oblivion-backend-team_api-v2');
  const apiProject = await prisma.project.create({
    data: {
      groupId: backendTeam.id,
      tenantId: tenant.id,
      name: 'API v2',
      slug: 'api-v2',
      description: 'Building the next version of the public API',
      oblivionTag: 'api-v2',
      slackChannelId: apiChannelId,
      slackChannelName: '#oblivion-backend-team_api-v2',
      isActive: true,
    },
  });

  const dashboardChannelId = await createOrFindSlackChannel('oblivion-frontend-team_dashboard-redesign');
  const dashboardProject = await prisma.project.create({
    data: {
      groupId: frontendTeam.id,
      tenantId: tenant.id,
      name: 'Dashboard Redesign',
      slug: 'dashboard-redesign',
      description: 'Modernizing the user dashboard UI',
      oblivionTag: 'dashboard',
      slackChannelId: dashboardChannelId,
      slackChannelName: '#oblivion-frontend-team_dashboard-redesign',
      isActive: true,
    },
  });
  console.log(`✅ Created 3 projects`);

  // Create tasks
  await prisma.task.createMany({
    data: [
      {
        projectId: authProject.id,
        clickupTaskId: 'clickup-task-001',
        title: 'Implement JWT token refresh',
        status: TaskStatus.TODO,
        priority: 1,
      },
      {
        projectId: authProject.id,
        clickupTaskId: 'clickup-task-002',
        title: 'Add OAuth2 support',
        status: TaskStatus.CLAIMED,
        priority: 2,
        claimedByAgentId: agents[0].id,
        claimedAt: new Date(),
      },
      {
        projectId: dashboardProject.id,
        clickupTaskId: 'clickup-task-003',
        title: 'Design new navigation component',
        status: TaskStatus.IN_PROGRESS,
        priority: 1,
        claimedByAgentId: agents[1].id,
        claimedAt: new Date(Date.now() - 3600000),
      },
      {
        projectId: apiProject.id,
        clickupTaskId: 'clickup-task-004',
        title: 'Implement rate limiting',
        status: TaskStatus.TODO,
        priority: 2,
      },
    ],
  });
  console.log(`✅ Created 4 tasks`);

  console.log('\n📋 Test credentials:');
  console.log('─────────────────────────────────────────────────────────');
  console.log('Backend Agent:  client_id=backend-agent,      client_secret=test_secret_1');
  console.log('Frontend Agent: client_id=frontend-agent,     client_secret=test_secret_2');
  console.log('DevOps Agent:   client_id=devops-agent,       client_secret=test_secret_3');
  console.log('Observer:       client_id=observer-dashboard, client_secret=observer_secret');
  console.log('Claude Code:    client_id=claude-code-agent,  client_secret=claude_secret');
  console.log('─────────────────────────────────────────────────────────');

  console.log('\n🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
