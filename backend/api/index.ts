import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import express from 'express';
import { AppServerlessModule } from '../src/app.serverless.module';

const expressApp = express();
let nestApp: any;

async function bootstrap() {
  if (nestApp) return nestApp;

  nestApp = await NestFactory.create(AppServerlessModule, new ExpressAdapter(expressApp), {
    logger: ['error', 'warn'],
  });

  nestApp.enableCors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  });

  nestApp.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );

  nestApp.setGlobalPrefix('api');
  await nestApp.init();
  return nestApp;
}

export default async function handler(req: any, res: any) {
  await bootstrap();
  expressApp(req, res);
}
