import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import passport from 'passport';
import { ConfigService } from '@nestjs/config';
import RedisStore from 'connect-redis';
import { createClient } from 'redis';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const corsOrigin = configService.get<string>('CORS_ORIGIN') || 'http://localhost:3000';
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CCE-TOKEN']
  });

  app.use(cookieParser());

  // Redis client setup
  const redisUrl = configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
  const redisClient = createClient({ url: redisUrl });
  redisClient.on('error', (err) => console.error('Redis Client Error', err));
  redisClient.on('connect', () => console.log('Redis Client Connected'));
  await redisClient.connect();

  // Session configuration with Redis store
  const sessionSecret = configService.getOrThrow<string>('SESSION_SECRET');
  const sessionCookieName = configService.getOrThrow<string>('SESSION_COOKIE_NAME') || 'axis-session';
  const isProduction = configService.getOrThrow<string>('NODE_ENV') === 'production';
  const cookieSecure = configService.getOrThrow<string>('SESSION_COOKIE_SECURE');
  const secureFlag = typeof cookieSecure === 'string' ? cookieSecure.toLowerCase() === 'true' : isProduction;
  const sameSite: 'lax' = 'lax';
  const maxAge = Number(configService.getOrThrow<string>('SESSION_COOKIE_MAX_AGE') || 60 * 60 * 1000);

  const redisStore = new RedisStore({
    client: redisClient,
    prefix: 'session:',
    ttl: maxAge / 1000, // TTL in seconds
  });

  app.use(
    session({
      store: redisStore,
      name: sessionCookieName,
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite,
        secure: secureFlag,
        maxAge,
      },
    }),
  );
  app.use(passport.initialize());
  app.use(passport.session());

  const port = Number(configService.getOrThrow<string>('PORT') || 3001);
  await app.listen(port);
  console.log(`Passport backend listening on http://localhost:${port}`);
  console.log(`Redis session store configured at ${redisUrl}`);
}

bootstrap();
