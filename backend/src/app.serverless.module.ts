// Serverless-safe module — excludes ScheduleModule and TelegramModule
// (cron jobs and long-running tasks don't work in serverless functions)
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health.controller';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { FitnessModule } from './fitness/fitness.module';
import { SleepModule } from './sleep/sleep.module';
import { HabitsModule } from './habits/habits.module';
import { DietModule } from './diet/diet.module';
import { AiModule } from './ai/ai.module';
import { EnglishModule } from './english/english.module';
import { KannadaModule } from './kannada/kannada.module';
import { CareerModule } from './career/career.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    FitnessModule,
    SleepModule,
    HabitsModule,
    DietModule,
    AiModule,
    EnglishModule,
    KannadaModule,
    CareerModule,
    AnalyticsModule,
    ReportsModule,
  ],
})
export class AppServerlessModule {}
