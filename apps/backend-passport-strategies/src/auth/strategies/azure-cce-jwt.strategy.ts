import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { ConfigService } from '@nestjs/config';

/**
 * Estrategia simplificada usando passport-jwt + jwks-rsa
 *
 * PROS:
 * - Mucho más simple (60% menos código)
 * - Usa librerías estándar y bien mantenidas
 * - jwks-rsa maneja caché de claves automáticamente
 * - passport-jwt es el estándar de facto
 *
 * CONTRAS:
 * - Necesita configurar dos estrategias separadas para v1 y v2 (si realmente necesitas soportar ambos)
 * - Menos control fino sobre el proceso de verificación
 */

@Injectable()
export class AzureCceJwtStrategyV1 extends PassportStrategy(JwtStrategy, 'azure-cce-jwt') {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    const provider = 'azure';
    const jwksUri = config.get<string>(`OIDC_CCE_JWKS_URL_${provider}`)
                 ?? config.get<string>(`OIDC_JWKS_URL_${provider}`)
                 ?? 'https://login.microsoftonline.com/common/discovery/v2.0/keys';

    const issuer = config.get<string>(`OIDC_ISSUER_${provider}`);
    const audience = config.get<string>(`OIDC_AUDIENCE_${provider}`);
    const relaxAudience = config.get<boolean>(`OIDC_RELAX_AUDIENCE_${provider}`, true);
    const clockTolerance = Number(config.get<string>(`OIDC_CLOCK_TOLERANCE_${provider}`)) || 60;

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      // jwks-rsa se encarga de obtener y cachear las claves públicas automáticamente
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri,
      }),

      // Opciones de verificación
      issuer: issuer,
      audience: relaxAudience ? undefined : audience,  // Si relaxAudience=true, no valida audience
      algorithms: ['RS256'],
      clockTolerance,
    });
  }

  /**
   * Este método es llamado automáticamente después de validar el token
   * El payload ya está verificado (firma, issuer, audience, exp, etc.)
   */
  async validate(payload: any) {
    return {
      sub: payload.sub,
      tid: payload.tid,
      aud: payload.aud,
      appId: payload.appid ?? payload.azp,
      version: payload.ver,
      roles: Array.isArray(payload.roles) ? payload.roles : [],
      scopes: typeof payload.scp === 'string' ? payload.scp.split(' ') : [],
      claims: payload,
    };
  }
}
