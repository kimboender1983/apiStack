import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: process.env.NODE_ENV !== 'production' }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  await app.register(require('@fastify/cors'), {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.register(require('@fastify/multipart'), {
    limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB global limit
  });

  await app.register(require('@fastify/static'), {
    root: join(process.cwd(), 'uploads'),
    prefix: '/uploads/',
  });

  // Health check for Railway / load balancers
  app.getHttpAdapter().get('/health', (_req: any, res: any) => {
    res.status(200).send({ status: 'ok' });
  });

  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port, '0.0.0.0');
  console.log(`APIForge running on port ${port}`);
}

bootstrap();
