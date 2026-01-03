/**
 * Database Seed Script
 *
 * Creates initial tenant and agent for local development.
 *
 * Usage:
 *   npx ts-node prisma/seed/seed.ts
 *   # or via package.json script:
 *   pnpm db:seed
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

// Prisma 7 requires a driver adapter
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

/**
 * Generate a random string for client ID/secret.
 */
function generateSecret(prefix: string, length: number = 32): string {
  return `${prefix}_${crypto.randomBytes(length).toString('hex')}`;
}

async function main() {
  console.log('🌱 Seeding database...\n');

  // ==========================================================================
  // 1. Create Development Tenant
  // ==========================================================================
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'dev-squad' },
    update: {},
    create: {
      name: 'Development Squad',
      slug: 'dev-squad',
    },
  });

  console.log(`✅ Tenant created: ${tenant.name} (${tenant.id})`);

  // ==========================================================================
  // 2. Create First Agent
  // ==========================================================================
  const clientId = generateSecret('agent', 16);
  const clientSecret = generateSecret('secret', 32);

  // Hash the secret for storage (bcrypt with 10 rounds)
  const hashedSecret = await bcrypt.hash(clientSecret, 10);

  const agent = await prisma.agent.upsert({
    where: { clientId: clientId },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Dev Agent',
      description: 'Development and testing agent',
      clientId: clientId,
      clientSecret: hashedSecret,
      isActive: true,
    },
  });

  console.log(`✅ Agent created: ${agent.name} (${agent.id})`);

  // ==========================================================================
  // 3. Create Agent Alias
  // ==========================================================================
  const alias = await prisma.agentAlias.upsert({
    where: {
      tenantId_alias: {
        tenantId: tenant.id,
        alias: 'AI_Squad',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      alias: 'AI_Squad',
      agents: {
        connect: { id: agent.id },
      },
    },
  });

  console.log(`✅ Alias created: @${alias.alias}`);

  // ==========================================================================
  // 4. Print Credentials (SAVE THESE!)
  // ==========================================================================
  console.log('\n' + '='.repeat(60));
  console.log('🔑 AGENT CREDENTIALS (save these!)');
  console.log('='.repeat(60));
  console.log(`client_id:     ${clientId}`);
  console.log(`client_secret: ${clientSecret}`);
  console.log('='.repeat(60));
  console.log('\nTest with:');
  console.log(`curl -X POST http://localhost:3000/auth/token \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '{"client_id": "${clientId}", "client_secret": "${clientSecret}"}'`);
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
