import { PrismaClient, TaskStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

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
  ]);
  console.log(`✅ Created ${agents.length} agents`);

  // Create groups
  const backendTeam = await prisma.group.create({
    data: {
      tenantId: tenant.id,
      name: 'Backend Team',
      slug: 'backend-team',
      description: 'Handles all backend services and APIs',
      slackChannelName: '#oblivion-backend-team',
      isActive: true,
    },
  });

  const frontendTeam = await prisma.group.create({
    data: {
      tenantId: tenant.id,
      name: 'Frontend Team',
      slug: 'frontend-team',
      description: 'Handles all UI/UX and frontend applications',
      slackChannelName: '#oblivion-frontend-team',
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
    ],
  });
  console.log(`✅ Created 3 group memberships`);

  // Create projects
  const authProject = await prisma.project.create({
    data: {
      groupId: backendTeam.id,
      tenantId: tenant.id,
      name: 'Auth Refactor',
      slug: 'auth-refactor',
      description: 'Refactoring the authentication system to use JWT',
      oblivionTag: 'auth-refactor',
      slackChannelName: '#oblivion-auth-refactor',
      isActive: true,
    },
  });

  const apiProject = await prisma.project.create({
    data: {
      groupId: backendTeam.id,
      tenantId: tenant.id,
      name: 'API v2',
      slug: 'api-v2',
      description: 'Building the next version of the public API',
      oblivionTag: 'api-v2',
      slackChannelName: '#oblivion-api-v2',
      isActive: true,
    },
  });

  const dashboardProject = await prisma.project.create({
    data: {
      groupId: frontendTeam.id,
      tenantId: tenant.id,
      name: 'Dashboard Redesign',
      slug: 'dashboard-redesign',
      description: 'Modernizing the user dashboard UI',
      oblivionTag: 'dashboard',
      slackChannelName: '#oblivion-dashboard',
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
  console.log('─────────────────────────────────────────');
  console.log('Backend Agent:  client_id=backend-agent,  client_secret=test_secret_1');
  console.log('Frontend Agent: client_id=frontend-agent, client_secret=test_secret_2');
  console.log('DevOps Agent:   client_id=devops-agent,   client_secret=test_secret_3');
  console.log('─────────────────────────────────────────');

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
