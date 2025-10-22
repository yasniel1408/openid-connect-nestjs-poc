import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller.js';
import { LocalUsernameStrategy } from './strategies/local-username.strategy.js';
import { LocalEmailStrategy } from './strategies/local-email.strategy.js';
import { LocalCodeStrategy } from './strategies/local-code.strategy.js';
import { OidcAzureStrategy } from './strategies/oidc-azure.strategy.js';
import { OidcGoogleStrategy } from './strategies/oidc-google.strategy.js';
import { AzureCceJwtStrategy } from './strategies/azure-cce-jwt.strategy.js';
import { AnyAuthGuard } from './guards/any-auth.guard.js';
import { SessionSyncMiddleware } from './middleware/session-sync.middleware.js';
import { OidcService } from './services/oidc.service.js';
import { CookieService } from './services/cookie.service.js';
import { AuthConfigService } from './services/auth-config.service.js';
import { GetTokenByUserService } from './services/get-token-by-user.service.js';
import { DiscoveryService } from './services/discovery.service.js';
import { CceTokenService } from './services/cce.service.js';
import { JwtModule } from '@nestjs/jwt';

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
  controllers: [AuthController],
  providers: [
    DiscoveryService,
    LocalUsernameStrategy,
    LocalEmailStrategy,
    LocalCodeStrategy,
    OidcAzureStrategy,
    OidcGoogleStrategy,
    AzureCceJwtStrategy,
    AnyAuthGuard,
    SessionSyncMiddleware,
    OidcService,
    CceTokenService,
    GetTokenByUserService,
    CookieService,
    AuthConfigService,
  ],
  exports: [AnyAuthGuard, SessionSyncMiddleware, CookieService, AuthConfigService],
})
export class AuthModule {}
