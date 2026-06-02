import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
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
import { TelegramModule } from './telegram/telegram.module';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.local', '.env'] }), // env reload
    ScheduleModule.forRoot(),
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
    TelegramModule,
  ],
})
export class AppModule {}
