import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

// Prisma 7 requires a driver adapter
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database (minimal)...');

  // Clean up existing data (in reverse dependency order)
  await prisma.task.deleteMany();
  await prisma.agentGroupMembership.deleteMany();
  await prisma.project.deleteMany();
  await prisma.group.deleteMany();
  await prisma.registrationToken.deleteMany();
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

  // Create Observer Dashboard agent (required for UI)
  const observer = await prisma.agent.create({
    data: {
      tenantId: tenant.id,
      name: 'Observer Dashboard',
      description: 'Admin dashboard for monitoring the agent ecosystem',
      clientId: 'observer-dashboard',
      clientSecret: await bcrypt.hash('observer_secret', 10),
      capabilities: ['observe', 'admin'],
      isActive: true,
    },
  });
  console.log(`✅ Created agent: ${observer.name}`);

  console.log('\n📋 Credentials:');
  console.log('─────────────────────────────────────────────────────────');
  console.log('Observer: client_id=observer-dashboard, client_secret=observer_secret');
  console.log('─────────────────────────────────────────────────────────');

  console.log('\n🎉 Minimal seed complete!');
  console.log('💡 Create groups, projects, and agents via the Observer UI at http://localhost:3001');
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
