import { Injectable, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as OpenIDConnectStrategy } from 'passport-openidconnect';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class OidcPkceAzureStrategy extends PassportStrategy(OpenIDConnectStrategy, 'oidc-azure') {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    const provider = 'azure';
    const issuer = config.get<string>(`OIDC_ISSUER_${provider}`);
    const clientID = config.get<string>(`OIDC_CLIENT_ID_${provider}`);
    const clientSecret = config.get<string>(`OIDC_CLIENT_SECRET_${provider}`);
    const callbackURL = config.get<string>(`OIDC_REDIRECT_URI_${provider}`);
    const scopeStr = config.get<string>(`OIDC_SCOPE_${provider}`) || 'openid profile email';
    const scope = scopeStr.split(' ');

    if (!issuer || !clientID) {
      throw new Error(`Missing OIDC configuration for ${provider}`);
    }

    // Azure AD v2.0 endpoints
    const base = issuer.replace('/.well-known/openid-configuration', '').replace('/v2.0', '');
    const authorizationURL = `${base}/oauth2/v2.0/authorize`;
    const tokenURL = `${base}/oauth2/v2.0/token`;
    const userInfoURL = 'https://graph.microsoft.com/oidc/userinfo';

    super(
      {
        issuer,
        authorizationURL,
        tokenURL,
        userInfoURL,
        clientID,
        clientSecret,
        callbackURL,
        scope,
        passReqToCallback: true, // ✅ CLAVE: Esto hace que recibas todos los tokens
      },
      (
        req: Request,
        issuer: string,
        profile: any,
        context: any,
        idToken: string,
        accessToken: string,
        refreshToken: string,
        done: Function
      ) => {
        try {
          const user = {
            id: profile?.id || profile?.sub || context?.claims?.sub,
            name: profile?.displayName || profile?.name || context?.claims?.name,
            email: profile?._json?.email || profile?._json?.preferred_username || profile?.emails?.[0]?.value || context?.claims?.email,
            identityProvider: issuer,
            roles: profile?._json?.roles || context?.claims?.roles || [],
            tokens: {
              access_token: accessToken,
              id_token: idToken,
              refresh_token: refreshToken,
              token_type: 'Bearer',
            },
          };

          console.log(user);

          done(null, user);
        } catch (error: any) {
          console.error(`❌ [Azure Strategy] Error:`, error);
          done(error, null);
        }
      }
    );
  }
}
