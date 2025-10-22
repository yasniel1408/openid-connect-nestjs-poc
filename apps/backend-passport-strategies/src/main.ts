import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import passport from 'passport';
import { ConfigService } from '@nestjs/config';

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
  const sessionSecret = configService.getOrThrow<string>('SESSION_SECRET');
  const sessionCookieName = configService.getOrThrow<string>('SESSION_COOKIE_NAME') || 'axis-session';
  const isProduction = configService.getOrThrow<string>('NODE_ENV') === 'production';
  const cookieSecure = configService.getOrThrow<string>('SESSION_COOKIE_SECURE');
  const secureFlag = typeof cookieSecure === 'string' ? cookieSecure.toLowerCase() === 'true' : isProduction;
  const sameSite: 'lax' = 'lax';
  const maxAge = Number(configService.getOrThrow<string>('SESSION_COOKIE_MAX_AGE') || 60 * 60 * 1000);
  app.use(
    session({
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
}

bootstrap();
