import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy as JwtStrategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { AuthConfigService } from '../services/auth-config.service.js';

function tenantFromIssuer(issuer?: string): string | undefined {
  if (!issuer) return undefined;
  const match = issuer.match(/[0-9a-fA-F-]{36}/);
  return match ? match[0] : undefined;
}

@Injectable()
export class AzureCceJwtStrategy extends PassportStrategy(JwtStrategy, 'oidc-azure-cce') {
  constructor(@Inject(AuthConfigService) authConfig: AuthConfigService) {
    const issuer = authConfig.getProviderSetting('azure', 'OIDC_ISSUER') ?? authConfig.getProviderSetting('azure', 'OIDC_ISSUER_URL');
    const tenant = tenantFromIssuer(issuer);
    if (!tenant) {
      throw new Error('OIDC_ISSUER_azure must include the tenant GUID');
    }

    const relaxAudience = authConfig.getBoolean('OIDC_RELAX_AUDIENCE_azure', true);
    const audience = relaxAudience ? undefined : authConfig.getProviderSetting('azure', 'OIDC_AUDIENCE') || undefined;

    const issuers = [
      `https://login.microsoftonline.com/${tenant}/v2.0`,
      `https://sts.windows.net/${tenant}/`,
    ];

    const jwksUri = `https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`;

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKeyProvider: passportJwtSecret({
        jwksUri,
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
      }) as any,
      algorithms: ['RS256'],
      issuer: issuers,
      audience,
      ignoreExpiration: false,
      clockTolerance: 60,
    });
  }

  async validate(payload: any) {
    return {
      callerAppId: payload.appid ?? payload.azp,
      roles: payload.roles ?? [],
      tenantId: payload.tid,
      audience: payload.aud,
      identityProvider: 'aad',
      id: payload.sub,
      name: payload.name,
      email: payload.email || payload.preferred_username,
    };
  }
}
