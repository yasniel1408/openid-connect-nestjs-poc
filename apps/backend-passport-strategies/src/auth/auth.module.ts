import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

// Controllers
import { LocalAuthController } from './controllers/local-auth.controller.js';
import { OidcAuthController } from './controllers/oidc-auth.controller.js';
import { JwtAuthController } from './controllers/jwt-auth.controller.js';
import { CommonAuthController } from './controllers/common-auth.controller.js';

// Strategies
import { LocalUsernameStrategy } from './strategies/local-username.strategy.js';
import { LocalJwtStrategy } from './strategies/local-jwt.strategy.js';
import { OidcPkceAzureStrategy } from './strategies/oidc-pkce-azure.strategy.js';
import { OidcPkceGoogleStrategy } from './strategies/oidc-pkce-google.strategy.js';
import { AzureCceJwtStrategyV1 } from './strategies/azure-cce-jwt.strategy.js';
import { AzureCceJwtStrategyV2 } from './strategies/azure-cce-jwt.strategy.OPCION2.js';

// Services
import { OidcService } from './services/oidc.service.js';
import { CookieService } from './services/cookie.service.js';
import { AuthConfigService } from './services/auth-config.service.js';
import { GetTokenByUserService } from './services/get-token-by-user.service.js';
import { DiscoveryService } from './services/discovery.service.js';
import { CceTokenService } from './services/cce.service.js';

// Middleware & Guards
import { SessionSyncMiddleware } from './middleware/session-sync.middleware.js';
import { AnyAuthGuard } from './guards/any-auth.guard.js';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ session: true }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.getOrThrow<string>('SESSION_SECRET');
        return {
          secret,
          signOptions: {
            algorithm: 'HS256',
            expiresIn: '1h',
          },
        };
      },
    }),
  ],
  controllers: [
    LocalAuthController,
    OidcAuthController,
    JwtAuthController,
    CommonAuthController,
  ],
  providers: [
    // Services
    DiscoveryService,
    OidcService,
    CceTokenService,
    GetTokenByUserService,
    CookieService,
    AuthConfigService,
    // Strategies
    LocalUsernameStrategy,
    LocalJwtStrategy,
    OidcPkceAzureStrategy,
    OidcPkceGoogleStrategy,
    AzureCceJwtStrategyV1,
    AzureCceJwtStrategyV2,
    // Middleware & Guards
    SessionSyncMiddleware,
    AnyAuthGuard,
  ],
  exports: [AnyAuthGuard, SessionSyncMiddleware, CookieService, AuthConfigService],
})
export class AuthModule {}
