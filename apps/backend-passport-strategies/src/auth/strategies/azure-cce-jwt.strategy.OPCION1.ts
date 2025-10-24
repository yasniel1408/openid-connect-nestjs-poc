import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { AuthConfigService } from '../services/auth-config.service.js';

/**
 * OPCIÓN 1: Estrategia simplificada usando passport-jwt + jwks-rsa
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
  constructor(@Inject(AuthConfigService) private readonly authConfig: AuthConfigService) {
    const provider = 'azure';
    const jwksUri = authConfig.getProviderSetting(provider, 'OIDC_CCE_JWKS_URL')
                 ?? authConfig.getProviderSetting(provider, 'OIDC_JWKS_URL')
                 ?? 'https://login.microsoftonline.com/common/discovery/v2.0/keys';

    const issuer = authConfig.getIssuer(provider);
    const audience = authConfig.getProviderSetting(provider, 'OIDC_AUDIENCE');
    const relaxAudience = authConfig.getBoolean(`OIDC_RELAX_AUDIENCE_${provider}`, true);
    const clockTolerance = Number(authConfig.getProviderSetting(provider, 'OIDC_CLOCK_TOLERANCE')) || 60;

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
    // Aquí puedes agregar lógica adicional si necesitas
    // Por ejemplo, verificar en base de datos, cargar permisos, etc.

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

/**
 * NOTA: Si necesitas soportar tokens v1.0 Y v2.0 simultáneamente,
 * puedes crear una segunda estrategia similar pero con el issuer v1:
 */

@Injectable()
export class AzureCceJwtStrategyV1Legacy extends PassportStrategy(JwtStrategy, 'azure-cce-jwt-v1') {
  constructor(@Inject(AuthConfigService) private readonly authConfig: AuthConfigService) {
    const provider = 'azure';
    const jwksUri = authConfig.getProviderSetting(provider, 'OIDC_V1_JWKS_URL')
                 ?? 'https://login.microsoftonline.com/common/discovery/keys';

    const issuer = authConfig.getProviderSetting(provider, 'OIDC_V1_ISSUER');
    const audience = authConfig.getProviderSetting(provider, 'OIDC_AUDIENCE');
    const relaxAudience = authConfig.getBoolean(`OIDC_RELAX_AUDIENCE_${provider}`, true);
    const clockTolerance = Number(authConfig.getProviderSetting(provider, 'OIDC_CLOCK_TOLERANCE')) || 60;

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri,
      }),
      issuer: issuer,
      audience: relaxAudience ? undefined : audience,
      algorithms: ['RS256'],
      clockTolerance,
    });
  }

  async validate(payload: any) {
    return {
      sub: payload.sub,
      tid: payload.tid,
      aud: payload.aud,
      appId: payload.appid ?? payload.azp,
      version: '1.0',
      roles: Array.isArray(payload.roles) ? payload.roles : [],
      scopes: typeof payload.scp === 'string' ? payload.scp.split(' ') : [],
      claims: payload,
    };
  }
}
