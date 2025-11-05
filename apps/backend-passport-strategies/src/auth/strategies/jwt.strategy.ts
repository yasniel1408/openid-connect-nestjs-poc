import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt, JwtFromRequestFunction } from 'passport-jwt';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';

export const cookieExtractor: JwtFromRequestFunction = (req: Request | undefined) => {
  if (!req) return null;
  const token = (req as any).cookies?.['axis-session'];
  return token || null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(@Inject(ConfigService) config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken()
      ]),
      secretOrKey: config.getOrThrow<string>('SESSION_SECRET'),
      issuer: config.get<string>('JWT_ISSUER', 'axis-backend'),
      audience: config.get<string>('JWT_AUDIENCE', 'axis-api'),
      ignoreExpiration: false,
      algorithms: ['HS256'],
      passReqToCallback: false,
    });
  }

  async validate(payload: any) {
    // El payload contiene la info del usuario que pusimos al crear el JWT
    return {
      id: payload.sub || payload.id,
      email: payload.email,
      name: payload.name,
      roles: payload.roles || [],
      identityProvider: payload.iss || 'jwt',
    };
  }
}
