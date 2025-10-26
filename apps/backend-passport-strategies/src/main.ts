import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ConfigService } from '@nestjs/config';
import { setupCookieSession } from './cookie.main.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // CORS Configuration
  const corsOrigin = configService.get<string>('CORS_ORIGIN') || 'http://localhost:3000';
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CCE-TOKEN']
  });

  // Cookie & Session Configuration (incluye Redis, express-session y passport)
  const cookieSessionConfig = await setupCookieSession(app, configService);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM received, closing gracefully...');
    await cookieSessionConfig.disconnect();
    await app.close();
  });

  process.on('SIGINT', async () => {
    console.log('🛑 SIGINT received, closing gracefully...');
    await cookieSessionConfig.disconnect();
    await app.close();
  });

  // Start server
  const port = Number(configService.get<string>('PORT') || 3001);
  await app.listen(port);
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`🚀 Passport backend listening on http://localhost:${port}`);
  console.log(`🌐 CORS origin: ${corsOrigin}`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
}

bootstrap();
