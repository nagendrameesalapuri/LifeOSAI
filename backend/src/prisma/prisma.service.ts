import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    // In serverless (Vercel), skip eager connect — Prisma connects lazily on first query.
    // This avoids cold-start timeouts and connection pool exhaustion.
    if (process.env.VERCEL) {
      this.logger.log('Serverless mode — skipping eager $connect()');
      return;
    }
    try {
      await this.$connect();
    } catch (e) {
      this.logger.error('Failed to connect to database on init', e);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect().catch(() => {});
  }
}
