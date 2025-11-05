import { Injectable, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as OpenIDConnectStrategy } from 'passport-openidconnect';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class OidcPkceGoogleStrategy extends PassportStrategy(OpenIDConnectStrategy, 'oidc-google') {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    const provider = 'google';
    const issuer = config.get<string>(`OIDC_ISSUER_${provider}`);
    const clientID = config.get<string>(`OIDC_CLIENT_ID_${provider}`);
    const clientSecret = config.get<string>(`OIDC_CLIENT_SECRET_${provider}`);
    const callbackURL = config.get<string>(`OIDC_REDIRECT_URI_${provider}`);
    const scopeStr = config.get<string>(`OIDC_SCOPE_${provider}`) || 'openid email profile';
    const scope = scopeStr.split(' ');

    if (!issuer || !clientID) {
      throw new Error(`Missing OIDC configuration for ${provider}`);
    }

    const authorizationURL = 'https://accounts.google.com/o/oauth2/v2/auth';
    const tokenURL = 'https://oauth2.googleapis.com/token';
    const userInfoURL = 'https://openidconnect.googleapis.com/v1/userinfo';

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
        passReqToCallback: true, // ✅ CLAVE
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
            email: profile?._json?.email || profile?.emails?.[0]?.value || context?.claims?.email,
            identityProvider: issuer,
            roles: [],
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
          console.error(`❌ [Google Strategy] Error:`, error);
          done(error, null);
        }
      }
    );
  }
}
