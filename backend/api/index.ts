import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import express from 'express';
import { AppServerlessModule } from '../src/app.serverless.module';

const expressApp = express();
let bootstrapPromise: Promise<void> | null = null;
let bootstrapError: string | null = null;

async function bootstrap(): Promise<void> {
  const nestApp = await NestFactory.create(
    AppServerlessModule,
    new ExpressAdapter(expressApp),
    { logger: false },
  );
  nestApp.enableCors({ origin: process.env.FRONTEND_URL || '*', credentials: true });
  nestApp.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );
  nestApp.setGlobalPrefix('api');
  await nestApp.init();
}

export default async function handler(req: any, res: any) {
  // Fast health check before NestJS boots (useful for Vercel warmup pings)
  if (req.url === '/api/health' || req.url === '/health') {
    res.status(200).json({ status: 'ok', service: 'lifeos-backend', bootstrapped: !!bootstrapPromise, error: bootstrapError });
    return;
  }

  if (!bootstrapPromise) {
    bootstrapPromise = bootstrap().catch((e) => {
      bootstrapError = e?.message || String(e);
      bootstrapPromise = null; // allow retry
      console.error('Bootstrap error:', e);
    });
  }

  try {
    await bootstrapPromise;
  } catch (e: any) {
    res.status(503).json({ error: 'Backend initializing', message: e?.message });
    return;
  }

  if (bootstrapError) {
    res.status(503).json({ error: 'Backend failed to start', message: bootstrapError });
    return;
  }

  expressApp(req, res);
}
