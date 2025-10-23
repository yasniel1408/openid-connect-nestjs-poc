import { Injectable, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as OpenIdConnectStrategy } from 'passport-openidconnect';
import { AuthConfigService } from '../services/auth-config.service.js';

@Injectable()
export class OidcPkceAzureStrategy extends PassportStrategy(OpenIdConnectStrategy, 'oidc-azure') {
  constructor(@Inject(AuthConfigService) authConfig: AuthConfigService) {
    const issuer = authConfig.getProviderSetting('azure', 'OIDC_ISSUER') ?? authConfig.getProviderSetting('azure', 'OIDC_ISSUER_URL') ?? 'https://login.microsoftonline.com/common/v2.0';
    if (!issuer) {
      throw new Error('Missing OIDC_ISSUER_azure configuration');
    }
    const clientID = authConfig.getProviderSetting('azure', 'OIDC_CLIENT_ID');
    if (!clientID) {
      throw new Error('Missing OIDC_CLIENT_ID_azure configuration');
    }
    const clientSecret = authConfig.getProviderSetting('azure', 'OIDC_CLIENT_SECRET');
    const callbackURL = authConfig.getProviderSetting('azure', 'OIDC_REDIRECT_URI') ?? 'http://localhost:3010/auth/azure/callback';
    const scope = (authConfig.getProviderSetting('azure', 'OIDC_SCOPE') ?? 'openid profile email').split(' ');

    const base = issuer.replace('/.well-known/openid-configuration', '');
    const authURL = `${base}/oauth2/v2.0/authorize`;
    const tokenURL = `${base}/oauth2/v2.0/token`;
    const userInfoURL = 'https://graph.microsoft.com/oidc/userinfo';

    super({
      issuer,
      authorizationURL: authURL,
      tokenURL,
      userInfoURL,
      clientID,
      clientSecret,
      callbackURL,
      scope,
      passReqToCallback: false,
    }, (issuerParam: string, profile: any, done: Function) => {
      // passport-openidconnect puts tokens in req.authInfo usually; here keep minimal
      const user = {
        id: profile?.id || profile?.sub,
        name: profile?.displayName || profile?.name,
        email: profile?._json?.email || profile?._json?.preferred_username || profile?.emails?.[0]?.value,
        identityProvider: issuerParam,
        roles: [],
      };
      done(null, user);
    });
  }
}
