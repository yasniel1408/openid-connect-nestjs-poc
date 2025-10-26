# 🚀 Ejemplos de Uso Avanzado - Cookie & Session Config

## Extensión de la Configuración

### Ejemplo 1: Múltiples Redis con Failover

```typescript
// cookie.main.advanced.ts
import { ConfigService } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';
import { createClient, createCluster } from 'redis';

export class AdvancedCookieSessionConfig extends CookieSessionConfig {
  
  /**
   * Configura Redis Cluster para alta disponibilidad
   */
  protected async setupRedisClient(configService: ConfigService): Promise<void> {
    const redisNodes = configService.get<string>('REDIS_NODES')?.split(',') || [];
    
    if (redisNodes.length > 1) {
      // Redis Cluster
      this.redisClient = await createCluster({
        rootNodes: redisNodes.map(url => ({ url })),
        defaults: {
          socket: {
            reconnectStrategy: (retries) => Math.min(retries * 50, 500)
          }
        }
      }).connect();
      
      console.log('✅ Redis Cluster Connected');
    } else {
      // Redis standalone con retry strategy
      const redisUrl = configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
      
      this.redisClient = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error('❌ Max Redis reconnection attempts reached');
              return new Error('Max reconnection attempts reached');
            }
            return Math.min(retries * 100, 3000);
          }
        }
      });
      
      await this.redisClient.connect();
    }
  }
}
```

### Ejemplo 2: Sesiones con Diferentes TTLs por Tipo de Usuario

```typescript
// En tu auth controller
@Post('login')
async login(@Body() credentials: any, @Req() req: Request, @Res() res: Response) {
  const user = await this.authService.validateUser(credentials);
  
  // Usuarios admin tienen sesiones más largas
  const sessionTTL = user.roles.includes('admin') 
    ? 7 * 24 * 60 * 60 * 1000  // 7 días
    : 1 * 60 * 60 * 1000;      // 1 hora
  
  req.session.cookie.maxAge = sessionTTL;
  req.session.user = user;
  
  return res.json({ success: true });
}
```

### Ejemplo 3: Acceso al Cliente Redis para Operaciones Personalizadas

```typescript
// En main.ts
const cookieSessionConfig = await setupCookieSession(app, configService);
const redisClient = cookieSessionConfig.getRedisClient();

if (redisClient) {
  // Operaciones personalizadas con Redis
  
  // 1. Contador de sesiones activas
  app.get('/stats/active-sessions', async (req, res) => {
    const keys = await redisClient.keys('session:*');
    return res.json({ activeSessions: keys.length });
  });
  
  // 2. Limpiar sesiones expiradas manualmente
  app.post('/admin/clear-expired-sessions', async (req, res) => {
    const keys = await redisClient.keys('session:*');
    let cleaned = 0;
    
    for (const key of keys) {
      const ttl = await redisClient.ttl(key);
      if (ttl < 0) {
        await redisClient.del(key);
        cleaned++;
      }
    }
    
    return res.json({ cleaned });
  });
  
  // 3. Invalidar todas las sesiones de un usuario
  app.post('/admin/logout-user/:userId', async (req, res) => {
    const userId = req.params.userId;
    const keys = await redisClient.keys('session:*');
    let invalidated = 0;
    
    for (const key of keys) {
      const sessionData = await redisClient.get(key);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        if (session.user?.id === userId) {
          await redisClient.del(key);
          invalidated++;
        }
      }
    }
    
    return res.json({ invalidated });
  });
}
```

### Ejemplo 4: Rate Limiting con Redis

```typescript
// rate-limiter.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RateLimiterMiddleware implements NestMiddleware {
  constructor(private readonly redisClient: RedisClientType) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip;
    const key = `rate_limit:${ip}`;
    
    const count = await this.redisClient.incr(key);
    
    if (count === 1) {
      // Primera request, establecer TTL de 1 minuto
      await this.redisClient.expire(key, 60);
    }
    
    if (count > 100) {
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: await this.redisClient.ttl(key)
      });
    }
    
    next();
  }
}

// En main.ts después de setupCookieSession
const redisClient = cookieSessionConfig.getRedisClient();
if (redisClient) {
  const rateLimiter = new RateLimiterMiddleware(redisClient);
  app.use(rateLimiter.use.bind(rateLimiter));
}
```

### Ejemplo 5: Cache de Datos con Redis

```typescript
// cache.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { RedisClientType } from 'redis';

@Injectable()
export class CacheService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redisClient: RedisClientType
  ) {}

  async get<T>(key: string): Promise<T | null> {
    const data = await this.redisClient.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    await this.redisClient.setEx(key, ttl, JSON.stringify(value));
  }

  async del(key: string): Promise<void> {
    await this.redisClient.del(key);
  }

  async invalidatePattern(pattern: string): Promise<number> {
    const keys = await this.redisClient.keys(pattern);
    if (keys.length === 0) return 0;
    return await this.redisClient.del(keys);
  }
}

// Uso en un servicio
@Injectable()
export class ProductsService {
  constructor(private readonly cache: CacheService) {}

  async getProducts() {
    // Intentar obtener del cache
    const cached = await this.cache.get<Product[]>('products:all');
    if (cached) return cached;

    // Si no está en cache, obtener de la DB
    const products = await this.fetchFromDatabase();
    
    // Guardar en cache por 5 minutos
    await this.cache.set('products:all', products, 300);
    
    return products;
  }
}
```

### Ejemplo 6: Sesiones con Refresh Token Rotation

```typescript
// En tu auth controller
@Post('refresh-token')
async refreshToken(@Req() req: Request, @Res() res: Response) {
  const session = (req as any).session;
  const refreshToken = session?.user?.tokens?.refresh_token;
  
  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh token' });
  }

  try {
    // Obtener nuevos tokens
    const newTokens = await this.oidcService.refreshTokens(
      session.user.provider,
      refreshToken
    );

    // Actualizar la sesión con los nuevos tokens
    session.user.tokens = newTokens;
    
    // Regenerar el session ID (rotation)
    await new Promise((resolve, reject) => {
      session.regenerate((err: any) => {
        if (err) reject(err);
        else resolve(true);
      });
    });

    return res.json({ success: true });
  } catch (error) {
    // Si falla el refresh, limpiar la sesión
    session.destroy(() => {});
    return res.status(401).json({ error: 'Refresh token expired' });
  }
}
```

### Ejemplo 7: Monitoreo de Sesiones en Tiempo Real

```typescript
// session-monitor.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { RedisClientType } from 'redis';

@Injectable()
export class SessionMonitorService implements OnModuleInit {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redisClient: RedisClientType
  ) {}

  async onModuleInit() {
    // Monitorear sesiones cada 30 segundos
    setInterval(() => this.logSessionStats(), 30000);
  }

  private async logSessionStats() {
    const keys = await this.redisClient.keys('session:*');
    const stats = {
      total: keys.length,
      byProvider: {} as Record<string, number>,
      expiringSoon: 0
    };

    for (const key of keys) {
      const ttl = await this.redisClient.ttl(key);
      const data = await this.redisClient.get(key);
      
      if (data) {
        const session = JSON.parse(data);
        const provider = session.user?.provider || 'unknown';
        stats.byProvider[provider] = (stats.byProvider[provider] || 0) + 1;
        
        if (ttl < 300) { // Menos de 5 minutos
          stats.expiringSoon++;
        }
      }
    }

    console.log('📊 Session Stats:', stats);
  }
}
```

### Ejemplo 8: Configuración Dinámica de Cookies por Request

```typescript
// dynamic-cookie.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class DynamicCookieMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Detectar si es un dispositivo móvil
    const isMobile = /mobile/i.test(req.headers['user-agent'] || '');
    
    // En móvil, sesiones más cortas
    if (isMobile && (req as any).session) {
      (req as any).session.cookie.maxAge = 30 * 60 * 1000; // 30 minutos
    }

    // Detectar si es una API call vs browser request
    const isApiCall = req.headers['x-requested-with'] === 'XMLHttpRequest';
    
    if (isApiCall) {
      // Para API calls, deshabilitar cookies automáticas
      res.setHeader('Cache-Control', 'no-store');
    }

    next();
  }
}
```

### Ejemplo 9: Backup de Sesiones

```typescript
// session-backup.service.ts
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RedisClientType } from 'redis';
import * as fs from 'fs/promises';

@Injectable()
export class SessionBackupService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redisClient: RedisClientType
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async backupSessions() {
    console.log('🔄 Starting session backup...');
    
    const keys = await this.redisClient.keys('session:*');
    const backup: Record<string, any> = {};

    for (const key of keys) {
      const data = await this.redisClient.get(key);
      const ttl = await this.redisClient.ttl(key);
      
      if (data) {
        backup[key] = {
          data: JSON.parse(data),
          ttl
        };
      }
    }

    const filename = `session-backup-${Date.now()}.json`;
    await fs.writeFile(filename, JSON.stringify(backup, null, 2));
    
    console.log(`✅ Session backup saved to ${filename}`);
  }

  async restoreSessions(filename: string) {
    const content = await fs.readFile(filename, 'utf-8');
    const backup = JSON.parse(content);

    let restored = 0;
    for (const [key, value] of Object.entries(backup as any)) {
      await this.redisClient.set(key, JSON.stringify(value.data));
      if (value.ttl > 0) {
        await this.redisClient.expire(key, value.ttl);
      }
      restored++;
    }

    console.log(`✅ Restored ${restored} sessions`);
  }
}
```

## Variables de Entorno para Configuración Avanzada

```env
# Redis básico
REDIS_URL=redis://localhost:6379

# Redis con autenticación
REDIS_URL=redis://:password@localhost:6379

# Redis Cluster
REDIS_NODES=redis://node1:6379,redis://node2:6379,redis://node3:6379

# Configuración de sesión
SESSION_SECRET=your-very-secure-secret-key-here
SESSION_COOKIE_NAME=axis-session
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_MAX_AGE=3600000

# Configuración de retry
REDIS_RETRY_ATTEMPTS=10
REDIS_RETRY_DELAY=1000

# Configuración de monitoreo
ENABLE_SESSION_MONITORING=true
SESSION_MONITOR_INTERVAL=30000
```

## Testing de Configuración Avanzada

```typescript
// cookie.main.spec.ts
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CookieSessionConfig } from './cookie.main';

describe('CookieSessionConfig', () => {
  let config: CookieSessionConfig;
  let configService: ConfigService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
            getOrThrow: jest.fn()
          }
        }
      ]
    }).compile();

    configService = module.get(ConfigService);
    config = new CookieSessionConfig();
  });

  it('should fallback to memory store if Redis fails', async () => {
    jest.spyOn(configService, 'get').mockReturnValue('redis://invalid:9999');
    
    const app = {} as any; // Mock app
    await config.configure(app, configService);
    
    expect(config.getRedisClient()).toBeNull();
  });
});
```

## Recursos

- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
- [Express Session Security](https://expressjs.com/en/advanced/best-practice-security.html)
- [NestJS Middleware](https://docs.nestjs.com/middleware)
