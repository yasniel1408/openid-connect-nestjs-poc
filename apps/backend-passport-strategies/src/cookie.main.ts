import { ConfigService } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import passport from 'passport';
import RedisStore from 'connect-redis';
import { createClient, RedisClientType } from 'redis';

export class CookieSessionConfig {
  private redisClient: RedisClientType | null = null;

  async configure(app: INestApplication, configService: ConfigService): Promise<void> {
    app.use(cookieParser());
    await this.setupRedisClient(configService);
    this.setupSession(app, configService);
    this.setupPassport(app);
    console.log('✅ Cookie & Session configuration completed');
  }

  private async setupRedisClient(configService: ConfigService): Promise<void> {
    const redisUrl = configService.get<string>('REDIS_URL') || 'redis://localhost:6379';

    this.redisClient = createClient({ url: redisUrl });

    // Event listeners
    this.redisClient.on('error', (err) => {
      console.error('❌ Redis Client Error:', err);
    });

    this.redisClient.on('connect', () => {
      console.log('✅ Redis Client Connected');
    });

    this.redisClient.on('reconnecting', () => {
      console.log('🔄 Redis Client Reconnecting...');
    });

    this.redisClient.on('ready', () => {
      console.log('✅ Redis Client Ready');
    });

    try {
      await this.redisClient.connect();
      console.log(`📦 Redis session store configured at ${redisUrl}`);
    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error);
      console.warn('⚠️  Falling back to in-memory sessions (not recommended for production)');
      this.redisClient = null;
    }
  }

  private setupSession(app: INestApplication, configService: ConfigService): void {
    const sessionSecret = configService.getOrThrow<string>('SESSION_SECRET');
    const sessionCookieName = configService.get<string>('SESSION_COOKIE_NAME') || 'axis-session';
    const isProduction = configService.get<string>('NODE_ENV') === 'production';
    const cookieSecure = configService.get<string>('SESSION_COOKIE_SECURE');
    const secureFlag = typeof cookieSecure === 'string'
      ? cookieSecure.toLowerCase() === 'true'
      : isProduction;
    const sameSite: 'lax' | 'strict' | 'none' = 'lax';
    const maxAge = Number(configService.get<string>('SESSION_COOKIE_MAX_AGE') || 3600000); // 1 hora por defecto

    const sessionConfig: session.SessionOptions = {
      name: sessionCookieName,
      secret: sessionSecret,
      resave: false,            // No guardar si no hay cambios (excepto con touch/save explícito)
      saveUninitialized: false, // No crear sesión hasta que haya datos
      rolling: true,            // ✅ Renovar cookie en cada request activo
      cookie: {
        httpOnly: true,
        sameSite,
        secure: secureFlag,
        maxAge,                 // ✅ Este se actualiza en cada request cuando rolling=true
      },
    };

    // Si Redis está disponible, usar RedisStore
    if (this.redisClient) {
      const redisStore: any = new (RedisStore as any)({
        client: this.redisClient,
        prefix: 'axis-session:',
        ttl: maxAge / 1000,      // TTL base en segundos (1 hora = 3600s)
        disableTouch: false,     // ✅ Permitir touch() para actualizar TTL
        disableTTL: false,       // ✅ Usar TTL de Redis
      });
      sessionConfig.store = redisStore;
      console.log('📦 Using Redis session store');
      console.log(`   - TTL: ${maxAge / 1000}s (${maxAge}ms)`);
      console.log(`   - Prefix: axis-session:`);
      console.log(`   - Touch enabled: true`);
    } else {
      console.warn('⚠️  Using in-memory session store (sessions will be lost on restart)');
    }

    app.use(session(sessionConfig));

    // Log de configuración
    console.log('🍪 Session configuration:');
    console.log(`   - Cookie name: ${sessionCookieName}`);
    console.log(`   - Max age: ${maxAge}ms (${maxAge / 1000}s)`);
    console.log(`   - Secure: ${secureFlag}`);
    console.log(`   - SameSite: ${sameSite}`);
    console.log(`   - Store: ${this.redisClient ? 'Redis' : 'Memory'}`);
  }

  private setupPassport(app: INestApplication): void {
    // Configurar serialización de usuario para sesiones
    passport.serializeUser((user: any, done) => {
      // Guardar todo el objeto user en la sesión
      done(null, user);
    });

    passport.deserializeUser((user: any, done) => {
      // Recuperar el usuario de la sesión
      done(null, user);
    });

    app.use(passport.initialize());
    app.use(passport.session());
    console.log('🔐 Passport initialized with session support');
  }

  async disconnect(): Promise<void> {
    if (this.redisClient) {
      try {
        await this.redisClient.quit();
        console.log('✅ Redis client disconnected gracefully');
      } catch (error) {
        console.error('❌ Error disconnecting Redis:', error);
      }
    }
  }

  getRedisClient(): RedisClientType | null {
    return this.redisClient;
  }
}

export async function setupCookieSession(
  app: INestApplication,
  configService: ConfigService
): Promise<CookieSessionConfig> {
  const config = new CookieSessionConfig();
  await config.configure(app, configService);
  return config;
}
