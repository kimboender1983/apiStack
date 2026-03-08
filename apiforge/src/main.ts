import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { AppModule } from './app.module';

process.on('uncaughtException', (err) => {
  console.error('[CRASH] uncaughtException:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[CRASH] unhandledRejection:', reason);
  process.exit(1);
});

async function bootstrap(): Promise<void> {
  const adapter = new FastifyAdapter({ logger: process.env.NODE_ENV !== 'production' });

  // Register CORS hook before NestJS seals the Fastify instance
  adapter.getInstance().addHook('onRequest', async (req, reply) => {
    const origin = req.headers.origin as string | undefined;
    if (origin) {
      reply.header('Access-Control-Allow-Origin', origin);
      reply.header('Access-Control-Allow-Credentials', 'true');
    }
    if (req.method === 'OPTIONS') {
      reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      reply.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
      reply.header('Access-Control-Max-Age', '86400');
      reply.status(204);
      await reply.send();
    }
  });

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  await app.register(require('@fastify/multipart'), {
    limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB global limit
  });

  await app.register(require('@fastify/static'), {
    root: join(process.cwd(), 'uploads'),
    prefix: '/uploads/',
  });

  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port, '0.0.0.0');
  console.log(`APIForge running on port ${port}`);
}

bootstrap();
