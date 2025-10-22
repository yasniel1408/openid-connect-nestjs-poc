// auth/azure-cce.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import type { Request } from 'express';
import * as jose from 'jose';// 1) webcrypto para jose si tu runtime lo requiere
import { ChainedTokenCredential, TokenCredential } from '@azure/identity';

// 2) Cargar env
const EXPECTED_ISSUER = process.env.OIDC_ISSUER_azure!;
const JWKS_URL = process.env.OIDC_CCE_JWKS_URL_azure!;
const EXPECTED_AUDIENCE = process.env.OIDC_CCE_AUDIENCE_azure; // opcional

// 3) JWKS singleton con caché interno
const JWKS = jose.createRemoteJWKSet(new URL(JWKS_URL));

@Injectable()
export class AzureCceJwtStrategy extends PassportStrategy(Strategy, 'azure-cce-jwt') {
  constructor() { super(); }

  async validate(req: Request) {
    try {
      const auth = req.headers.authorization ?? req.headers.Authorization as any;
      if (!auth || !String(auth).toLowerCase().startsWith('bearer '))
        throw new UnauthorizedException('NO_TOKEN');

      const token = String(auth).slice(7).trim();
      if (!token) throw new UnauthorizedException('INVALID_TOKEN_FORMAT');

      const { payload, protectedHeader } = await jose.jwtVerify(token, JWKS, {
        issuer: EXPECTED_ISSUER,
        audience: EXPECTED_AUDIENCE || undefined, // si lo seteás, se valida
        typ: 'JWT',
        algorithms: ['RS256'],
        clockTolerance: 5,
      });

      // Chequeos extra como en tu código previo
      if (payload.ver !== '2.0') throw new UnauthorizedException('ONLY_V2');
      // Si querés forzar tenant:
      if (payload.tid !== '981e0bff-7621-452e-8fb8-b9e4e9964e85') throw new UnauthorizedException('TENANT');

      return {
        id: payload.sub,
        appId: (payload as any).appid ?? (payload as any).azp,
        iss: payload.iss,
        aud: payload.aud,
        roles: Array.isArray(payload.roles) ? payload.roles : [],
        scopes: typeof payload.scp === 'string' ? payload.scp.split(' ') : [],
        claims: payload,
        alg: protectedHeader.alg,
      };
    } catch (e: any) {
      throw new UnauthorizedException(e?.message ?? 'TOKEN_VERIFICATION_FAILED');
    }
  }
}
