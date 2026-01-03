import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

/**
 * PrismaService wraps the Prisma Client for NestJS dependency injection.
 *
 * Usage in other modules:
 *   constructor(private prisma: PrismaService) {}
 *
 *   async findAgent(clientId: string) {
 *     return this.prisma.agent.findUnique({ where: { clientId } });
 *   }
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private pool: Pool;

  constructor() {
    // Prisma 7 requires a driver adapter
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);

    super({
      adapter,
      // Log queries in development for debugging
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['error'],
    });

    this.pool = pool;
  }

  /**
   * Connect to the database when the module initializes.
   * NestJS calls this automatically.
   */
  async onModuleInit() {
    await this.$connect();
  }

  /**
   * Disconnect from the database when the module is destroyed.
   * Ensures clean shutdown (no dangling connections).
   */
  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
