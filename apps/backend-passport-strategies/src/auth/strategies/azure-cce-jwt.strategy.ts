import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { BearerStrategy, IBearerStrategyOptionWithRequest, ITokenPayload } from 'passport-azure-ad';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AzureCceJwtStrategy extends PassportStrategy(BearerStrategy, 'azure-cce-jwt') {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    const provider = 'azure';
    const issuer = config.get<string>(`OIDC_ISSUER_${provider}`);
    const clientID = config.get<string>(`OIDC_CLIENT_ID_${provider}`);
    const audience = config.get<string>(`OIDC_AUDIENCE_${provider}`);
    const relaxAudience = config.get<boolean>(`OIDC_RELAX_AUDIENCE_${provider}`, true);
    const clockSkew = Number(config.get<string>(`OIDC_CLOCK_TOLERANCE_${provider}`)) || 60;

    // Extraer tenant ID del issuer
    const tenantIdMatch = issuer?.match(/[0-9a-fA-F-]{36}/);
    const tenantIdGuid = tenantIdMatch ? tenantIdMatch[0] : 'common';

    const options: IBearerStrategyOptionWithRequest = {
      identityMetadata: `https://login.microsoftonline.com/${tenantIdGuid}/v2.0/.well-known/openid-configuration`,
      clientID: clientID!,
      validateIssuer: true,
      issuer: issuer!,
      audience: relaxAudience ? undefined : audience,
      loggingLevel: 'info',
      passReqToCallback: false,
      clockSkew: clockSkew,
      // Scope validation (opcional)
      // scope: ['access_as_user'],
    };

    super(options, (token: ITokenPayload, done: any) => {
      const user = {
        sub: token.sub || token.oid,
        tid: token.tid,
        aud: token.aud,
        appId: token.appid || token.azp,
        version: token.ver,
        roles: Array.isArray(token.roles) ? token.roles : [],
        scopes: typeof token.scp === 'string' ? token.scp.split(' ') : [],
        claims: token,
      };
      done(null, user);
    });
  }
}
