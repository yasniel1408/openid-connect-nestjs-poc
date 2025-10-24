import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { BearerStrategy, IBearerStrategyOptionWithRequest, ITokenPayload } from 'passport-azure-ad';
import { AuthConfigService } from '../services/auth-config.service.js';

/**
 * OPCIÓN 2: Estrategia usando passport-azure-ad oficial de Microsoft
 *
 * PROS:
 * - Librería oficial de Microsoft
 * - Maneja automáticamente v1 y v2 de Azure AD
 * - Soporte completo para B2C, multitenant, etc.
 * - Validación de scopes y roles built-in
 * - Documentación oficial de Microsoft
 *
 * CONTRAS:
 * - Dependencia adicional (passport-azure-ad)
 * - Más opinada (hace cosas a la manera de Microsoft)
 * - Menos flexible para casos edge
 */

@Injectable()
export class AzureCceJwtStrategyV2 extends PassportStrategy(BearerStrategy, 'azure-cce-jwt-v2') {
  constructor(@Inject(AuthConfigService) private readonly authConfig: AuthConfigService) {
    const provider = 'azure';
    const issuer = authConfig.getIssuer(provider);
    const clientID = authConfig.getProviderSetting(provider, 'OIDC_CLIENT_ID');
    const audience = authConfig.getProviderSetting(provider, 'OIDC_AUDIENCE');
    const relaxAudience = authConfig.getBoolean(`OIDC_RELAX_AUDIENCE_${provider}`, true);
    const clockSkew = Number(authConfig.getProviderSetting(provider, 'OIDC_CLOCK_TOLERANCE')) || 60;

    // Extraer tenant ID del issuer
    const tenantIdMatch = issuer.match(/[0-9a-fA-F-]{36}/);
    const tenantIdGuid = tenantIdMatch ? tenantIdMatch[0] : 'common';

    const options: IBearerStrategyOptionWithRequest = {
      // Información de Azure AD
      identityMetadata: `https://login.microsoftonline.com/${tenantIdGuid}/v2.0/.well-known/openid-configuration`,
      clientID: clientID,

      // Validación de audience (si relaxAudience es true, no valida)
      validateIssuer: true,
      issuer: issuer,
      audience: relaxAudience ? undefined : audience,

      // Otras opciones
      loggingLevel: 'info',
      passReqToCallback: false,
      clockSkew: clockSkew,

      // Scope validation (opcional)
      // scope: ['access_as_user'],
    };

    super(options, (token: ITokenPayload, done: any) => {
      // Esta callback se ejecuta después de validar el token
      // El token ya está verificado por passport-azure-ad

      // Aquí puedes agregar validaciones adicionales
      // Por ejemplo, verificar roles específicos:
      // if (!token.roles || !token.roles.includes('Admin')) {
      //   return done(null, false, { message: 'Insufficient permissions' });
      // }

      // Transformar el payload a tu formato
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

  // No necesitas implementar validate() porque se maneja en el callback del constructor
}
