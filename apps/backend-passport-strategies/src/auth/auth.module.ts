import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
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
import { PublicCookieService } from './services/public-cookie.service.js';
import { AuthConfigService } from './services/auth-config.service.js';
import { GetTokenByUserService } from './services/get-token-by-user.service.js';
import { DiscoveryService } from './services/discovery.service.js';

@Module({
  imports: [ConfigModule, PassportModule.register({ session: true })],
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
    GetTokenByUserService,
    PublicCookieService,
    AuthConfigService,
  ],
  exports: [AnyAuthGuard, SessionSyncMiddleware, PublicCookieService, AuthConfigService],
})
export class AuthModule {}
