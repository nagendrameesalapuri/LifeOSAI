import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import express from 'express';
import { AppServerlessModule } from '../src/app.serverless.module';

const expressApp = express();
let initialized = false;
let initError: Error | null = null;

async function bootstrap() {
  if (initialized) return;
  if (initError) throw initError;

  try {
    const nestApp = await NestFactory.create(
      AppServerlessModule,
      new ExpressAdapter(expressApp),
      { logger: ['error', 'warn', 'log'] },
    );

    nestApp.enableCors({
      origin: process.env.FRONTEND_URL || '*',
      credentials: true,
    });

    nestApp.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
    );

    nestApp.setGlobalPrefix('api');
    await nestApp.init();
    initialized = true;
  } catch (e) {
    console.error('NestJS bootstrap failed:', e);
    initError = e as Error;
    throw e;
  }
}

export default async function handler(req: any, res: any) {
  try {
    await bootstrap();
    expressApp(req, res);
  } catch (e: any) {
    console.error('Handler error:', e?.message, e?.stack);
    res.status(500).json({
      error: 'Bootstrap failed',
      message: e?.message || 'Unknown error',
    });
  }
}
