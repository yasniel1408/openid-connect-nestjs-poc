import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

// Controllers
import { LocalAuthController } from './controllers/local-auth.controller';
import { OidcAuthController } from './controllers/oidc-auth.controller';
import { JwtAuthController } from './controllers/jwt-auth.controller';
import { CommonAuthController } from './controllers/common-auth.controller';

// Strategies
import { LocalSessionStrategy } from './strategies/local-session.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { OidcPkceAzureStrategy } from './strategies/oidc-pkce-azure.strategy';
import { OidcPkceGoogleStrategy } from './strategies/oidc-pkce-google.strategy';
import { AzureCceJwtStrategy } from './strategies/azure-cce-jwt.strategy';

// Services
import { CookieService } from './services/cookie.service';
import { GetTokenByUserService } from './services/get-token-by-user.service';
import { CceTokenService } from './services/cce.service';

// Middleware & Guards
import { AnyAuthGuard } from './guards/any-auth.guard';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ session: true }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('SESSION_SECRET'),
        signOptions: {
          algorithm: 'HS256' as const,
          expiresIn: '1h',
          issuer: config.get<string>('JWT_ISSUER', 'axis-backend'),
          audience: config.get<string>('JWT_AUDIENCE', 'axis-api'),
        },
      }),
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
    CceTokenService,
    GetTokenByUserService,
    CookieService,
    // Strategies
    LocalSessionStrategy,
    JwtStrategy,
    OidcPkceAzureStrategy,
    OidcPkceGoogleStrategy,
    AzureCceJwtStrategy,
    // Middleware & Guards
    AnyAuthGuard,
  ],
  exports: [AnyAuthGuard, CookieService],
})
export class AuthModule {}
