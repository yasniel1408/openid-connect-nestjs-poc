import { Injectable, Inject } from '@nestjs/common';
import { Issuer, Client, generators } from 'openid-client';
import { AuthConfigService } from './auth-config.service';

@Injectable()
export class OidcService {
  private clients = new Map<string, Promise<Client>>();

  constructor(@Inject(AuthConfigService) private readonly authConfig: AuthConfigService) {}

  private redirectUri(provider: string): string {
    return this.authConfig.getRedirectUri(provider);
  }

  async getClient(provider: string): Promise<Client> {
    if (!this.clients.has(provider)) {
      this.clients.set(
        provider,
        (async () => {
          const issuerUrl = this.authConfig.getIssuer(provider);
          const clientId = this.authConfig.getProviderSetting(provider, 'OIDC_CLIENT_ID');
          if (!issuerUrl || !clientId) {
            throw new Error(`Missing OIDC settings for provider ${provider}`);
          }
          const issuer = await Issuer.discover(issuerUrl);
          const clientSecret = this.authConfig.getProviderSetting(provider, 'OIDC_CLIENT_SECRET');
          return new issuer.Client({
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uris: [this.redirectUri(provider)],
            response_types: ['code'],
            token_endpoint_auth_method: clientSecret ? 'client_secret_post' : 'none',
          });
        })(),
      );
    }
    return this.clients.get(provider)!;
  }

  async getAuthUrl(provider: string, sess: any): Promise<string> {
    const client = await this.getClient(provider);
    const state = generators.state();
    const nonce = generators.nonce();
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);
    if (!sess.oidc) sess.oidc = {};
    sess.oidc[provider] = { state, nonce, codeVerifier };
    return client.authorizationUrl({
      scope: this.authConfig.getScope(provider),
      redirect_uri: this.redirectUri(provider),
      response_type: 'code',
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
  }

  async handleCallback(provider: string, params: any, sess: any) {
    const client = await this.getClient(provider);
    const saved = sess?.oidc?.[provider] || {};
    const tokenSet = await client.callback(this.redirectUri(provider), params, {
      state: saved.state,
      nonce: saved.nonce,
      code_verifier: saved.codeVerifier,
    });
    const userinfo = tokenSet.access_token ? await client.userinfo(tokenSet.access_token) : undefined;
    const claims = tokenSet.claims();
    const user = {
      provider,
      claims,
      userinfo,
      tokens: {
        access_token: tokenSet.access_token,
        id_token: tokenSet.id_token,
        refresh_token: tokenSet.refresh_token,
        expires_at: tokenSet.expires_at,
        token_type: tokenSet.token_type,
      },
      id: (claims.oid as string) || (claims.sub as string),
      name: (claims.name as string) || userinfo?.name,
      email: (claims.email as string) || (claims.preferred_username as string) || userinfo?.email,
      identityProvider: claims.iss as string,
      roles: (claims.roles as string[]) || (typeof claims.scp === 'string' ? (claims.scp as string).split(' ') : []),
    };
    sess.user = user;
    if (sess?.oidc?.[provider]) delete sess.oidc[provider];
    return user;
  }

  async endSessionUrl(provider: string, idToken: string) {
    const client = await this.getClient(provider);
    const postLogout = this.authConfig.getPostLogoutRedirect();
    const endSession = client.issuer.metadata.end_session_endpoint as string | undefined;
    if (!endSession) return postLogout;
    const url = new URL(endSession);
    url.searchParams.set('post_logout_redirect_uri', postLogout);
    url.searchParams.set('id_token_hint', idToken);
    return url.toString();
  }
}
