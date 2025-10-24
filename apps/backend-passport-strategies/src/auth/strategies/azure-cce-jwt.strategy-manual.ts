import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import type { Request } from 'express';
import * as jose from 'jose';
import { AuthConfigService } from '../services/auth-config.service.js';

@Injectable()
export class AzureCceJwtStrategy extends PassportStrategy(Strategy, 'azure-cce-jwt-manual') {
  private readonly provider = 'azure';
  private readonly expectedAudience?: string;
  private jwksV2?: ReturnType<typeof jose.createRemoteJWKSet>;
  private jwksV1?: ReturnType<typeof jose.createRemoteJWKSet>;
  private issuerV2: string;
  private issuerV1?: string;

  constructor(@Inject(AuthConfigService) private readonly authConfig: AuthConfigService) {
    super();
    this.expectedAudience = this.authConfig.getProviderSetting(this.provider, 'OIDC_AUDIENCE') ?? undefined;
    this.issuerV2 = this.authConfig.getIssuer(this.provider);
    const issuerV1 = this.authConfig.getProviderSetting(this.provider, 'OIDC_V1_ISSUER');
    if (issuerV1) this.issuerV1 = issuerV1;
  }

  private getJwksV2(): ReturnType<typeof jose.createRemoteJWKSet> {
    if (!this.jwksV2) {
      const url =
        this.authConfig.getProviderSetting(this.provider, 'OIDC_CCE_JWKS_URL') ??
        this.authConfig.getProviderSetting(this.provider, 'OIDC_JWKS_URL');
      if (!url) {
        throw new Error('Missing JWKS URL for Azure provider (v2)');
      }
      this.jwksV2 = jose.createRemoteJWKSet(new URL(url));
    }
    return this.jwksV2;
  }

  private getJwksV1(): ReturnType<typeof jose.createRemoteJWKSet> {
    if (!this.jwksV1) {
      const url =
        this.authConfig.getProviderSetting(this.provider, 'OIDC_V1_JWKS_URL') ??
        'https://login.microsoftonline.com/common/discovery/keys';
      this.jwksV1 = jose.createRemoteJWKSet(new URL(url));
    }
    return this.jwksV1;
  }

  private async verify(token: string) {
    const tolerance = Number(this.authConfig.getProviderSetting(this.provider, 'OIDC_CLOCK_TOLERANCE')) || 60;
    const relaxAudience = this.authConfig.getBoolean(`OIDC_RELAX_AUDIENCE_${this.provider}`, true);

    // Intentar primero con issuer/JWKS v2 (tokens ver = 2.0)
    try {
      const verifyOptions: any = {
        algorithms: ['RS256'],
        issuer: this.issuerV2,
        clockTolerance: tolerance,
      };

      // Solo validar audience si está configurada Y no es modo relax
      if (this.expectedAudience && !relaxAudience) {
        verifyOptions.audience = this.expectedAudience;
      }

      const result = await jose.jwtVerify(token, this.getJwksV2(), verifyOptions);
      return { ...result, version: '2.0' as const };
    } catch (err) {
      // continuar con v1
    }

    // Tokens emitidos desde /sts.windows.net/<tenant>/ (ver 1.0)
    if (!this.issuerV1) {
      throw new UnauthorizedException('TOKEN_INVALID');
    }

    const verifyOptionsV1: any = {
      algorithms: ['RS256'],
      issuer: this.issuerV1,
      clockTolerance: tolerance,
    };

    // Solo validar audience si está configurada Y no es modo relax
    if (this.expectedAudience && !relaxAudience) {
      verifyOptionsV1.audience = this.expectedAudience;
    }

    const resultV1 = await jose.jwtVerify(token, this.getJwksV1(), verifyOptionsV1);
    return { ...resultV1, version: '1.0' as const };
  }

  async validate(req: Request) {
    try {
      const auth = String(req.headers.authorization ?? '');
      if (!auth.toLowerCase().startsWith('bearer ')) {
        throw new UnauthorizedException('NO_TOKEN');
      }
      const token = auth.slice(7).trim();
      const { payload, version } = await this.verify(token);

      return {
        sub: payload.sub,
        tid: (payload as any).tid,
        aud: payload.aud,
        appId: (payload as any).appid ?? (payload as any).azp,
        version,
        roles: Array.isArray((payload as any).roles) ? ((payload as any).roles as string[]) : [],
        scopes: typeof (payload as any).scp === 'string' ? ((payload as any).scp as string).split(' ') : [],
        claims: payload,
      };
    } catch (e: any) {
      throw new UnauthorizedException(e?.message ?? 'TOKEN_INVALID');
    }
  }
}
