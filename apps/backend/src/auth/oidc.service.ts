import { Injectable } from '@nestjs/common';
import { Issuer, Client, generators } from 'openid-client';

@Injectable()
export class OidcService {
  private clients = new Map<string, Promise<Client>>();

  private getProviders(): string[] {
    const raw = process.env.OIDC_PROVIDERS || 'azure';
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }

  private envFor(provider: string, base: string): string | undefined {
    const key = `${base}_${provider}`;
    return process.env[key] || process.env[base];
  }

  private issuerFromEnv(provider: string): string {
    const issuer = this.envFor(provider, 'OIDC_ISSUER') || this.envFor(provider, 'OIDC_ISSUER_URL');
    if (!issuer) throw new Error(`Missing OIDC_ISSUER(_URL) for provider ${provider}`);
    return issuer;
  }

  private redirectUri(provider: string): string {
    return (
      this.envFor(provider, 'OIDC_REDIRECT_URI') ||
      `http://localhost:${process.env.PORT || 3001}/auth/${provider}/callback`
    );
  }

  private scope(provider: string): string {
    return this.envFor(provider, 'OIDC_SCOPE') || 'openid profile email';
  }

  async getClient(provider: string): Promise<Client> {
    if (!this.clients.has(provider)) {
      this.clients.set(
        provider,
        (async () => {
          const issuerUrl = this.issuerFromEnv(provider);
          const clientId = this.envFor(provider, 'OIDC_CLIENT_ID');
          if (!issuerUrl || !clientId) throw new Error(`Missing OIDC settings for provider ${provider}`);
          const issuer = await Issuer.discover(issuerUrl);
          const clientSecret = this.envFor(provider, 'OIDC_CLIENT_SECRET');
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
      scope: this.scope(provider),
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
    const saved = (sess && sess.oidc && sess.oidc[provider]) || {};
    const tokenSet = await client.callback(this.redirectUri(provider), params, {
      state: saved.state,
      nonce: saved.nonce,
      code_verifier: saved.codeVerifier,
    });
    const userinfo = tokenSet.access_token ? await client.userinfo(tokenSet.access_token) : undefined;
    const claims = tokenSet.claims();
    sess.user = { provider, claims, userinfo, tokens: tokenSet };
    if (sess.oidc && sess.oidc[provider]) delete sess.oidc[provider];
    return sess.user;
  }

  async endSessionUrl(provider: string, idToken: string) {
    const client = await this.getClient(provider);
    const postLogout = process.env.POST_LOGOUT_REDIRECT_URI || process.env.CORS_ORIGIN || 'http://localhost:3000';
    const endSession = (client.issuer.metadata as any).end_session_endpoint as string | undefined;
    if (!endSession) return postLogout; // proveedor sin fin de sesión: vuelve al front
    const url = new URL(endSession);
    url.searchParams.set('post_logout_redirect_uri', postLogout);
    url.searchParams.set('id_token_hint', idToken);
    return url.toString();
  }

  getAudience(provider?: string): { audiences: string[]; relax: boolean } {
    const prov = provider || '';
    const audRaw = this.envFor(prov, 'OIDC_AUDIENCE') || '';
    const audiences = audRaw.split(',').map((s) => s.trim()).filter(Boolean);
    const relax = (this.envFor(prov, 'OIDC_RELAX_AUDIENCE') || process.env.OIDC_RELAX_AUDIENCE || 'false').toLowerCase() === 'true';
    return { audiences, relax };
  }

  // resolve provider name from issuer string in token
  async providerFromIssuer(iss: string): Promise<string | undefined> {
    const candidates = this.getProviders();
    for (const p of candidates) {
      const envIss = this.issuerFromEnv(p);
      const baseEnvIss = envIss.replace('/.well-known/openid-configuration', '');
      if (iss.startsWith(baseEnvIss)) return p;
    }
    return undefined;
  }
}
