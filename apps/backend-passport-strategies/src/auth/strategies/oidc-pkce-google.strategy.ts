import { Injectable, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as OpenIdConnectStrategy } from 'passport-openidconnect';
import { AuthConfigService } from '../services/auth-config.service.js';

@Injectable()
export class OidcPkceGoogleStrategy extends PassportStrategy(OpenIdConnectStrategy, 'oidc-google') {
  constructor(@Inject(AuthConfigService) authConfig: AuthConfigService) {
    const issuer = authConfig.getProviderSetting('google', 'OIDC_ISSUER') ?? authConfig.getProviderSetting('google', 'OIDC_ISSUER_URL') ?? 'https://accounts.google.com';
    const clientID = authConfig.getProviderSetting('google', 'OIDC_CLIENT_ID');
    if (!clientID) {
      throw new Error('Missing OIDC_CLIENT_ID_google configuration');
    }
    const clientSecret = authConfig.getProviderSetting('google', 'OIDC_CLIENT_SECRET');
    const callbackURL = authConfig.getProviderSetting('google', 'OIDC_REDIRECT_URI') ?? 'http://localhost:3010/auth/google/callback';
    const scope = (authConfig.getProviderSetting('google', 'OIDC_SCOPE') ?? 'openid email profile').split(' ');

    const authorizationURL = 'https://accounts.google.com/o/oauth2/v2/auth';
    const tokenURL = 'https://oauth2.googleapis.com/token';
    const userInfoURL = 'https://openidconnect.googleapis.com/v1/userinfo';

    super({
      issuer,
      authorizationURL,
      tokenURL,
      userInfoURL,
      clientID,
      clientSecret,
      callbackURL,
      scope,
      passReqToCallback: false,
    }, (issuerParam: string, profile: any, done: Function) => {
      const user = {
        id: profile?.id || profile?.sub,
        name: profile?.displayName || profile?.name,
        email: profile?._json?.email || profile?.emails?.[0]?.value,
        identityProvider: issuerParam,
        roles: [],
      };
      done(null, user);
    });
  }
}
