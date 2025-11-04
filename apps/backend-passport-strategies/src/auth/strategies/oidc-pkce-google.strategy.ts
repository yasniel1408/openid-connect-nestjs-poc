import { Injectable, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as CustomStrategy } from 'passport-custom';
import { Issuer, Client, generators, TokenSet } from 'openid-client';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/**
 * Google OIDC Strategy con PKCE
 *
 * ✨ Usa passport-custom + openid-client para capturar tokens completos
 */
@Injectable()
export class OidcPkceGoogleStrategy extends PassportStrategy(CustomStrategy, 'oidc-google') {
  private clientPromise: Promise<Client>;
  private readonly provider = 'google';

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    super();
    this.clientPromise = this.initializeClient();
  }

  private async initializeClient(): Promise<Client> {
    const issuerUrl = this.config.get<string>(`OIDC_ISSUER_${this.provider}`);
    const clientId = this.config.get<string>(`OIDC_CLIENT_ID_${this.provider}`);
    const clientSecret = this.config.get<string>(`OIDC_CLIENT_SECRET_${this.provider}`);

    if (!issuerUrl || !clientId) {
      throw new Error(`Missing OIDC configuration for ${this.provider}`);
    }

    console.log(`🔍 Discovering Google OIDC endpoints from: ${issuerUrl}`);
    const issuer = await Issuer.discover(issuerUrl);

    const redirectUri = this.config.get<string>(`OIDC_REDIRECT_URI_${this.provider}`)
      || `http://localhost:${this.config.get('PORT', 3001)}/auth/${this.provider}/callback`;

    return new issuer.Client({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uris: [redirectUri],
      response_types: ['code'],
      token_endpoint_auth_method: clientSecret ? 'client_secret_post' : 'none',
    });
  }

  async validate(req: Request): Promise<any> {
    const client = await this.clientPromise;
    const session = (req as any).session;
    const query = req.query;

    // Iniciar flujo OAuth (no hay code)
    if (!query.code && !query.error) {
      const state = generators.state();
      const nonce = generators.nonce();
      const codeVerifier = generators.codeVerifier();
      const codeChallenge = generators.codeChallenge(codeVerifier);

      if (!session.oidc) session.oidc = {};
      session.oidc[this.provider] = { state, nonce, codeVerifier };

      const scope = this.config.get<string>(`OIDC_SCOPE_${this.provider}`) || 'openid email profile';
      const redirectUri = this.config.get<string>(`OIDC_REDIRECT_URI_${this.provider}`)
        || `http://localhost:${this.config.get('PORT', 3001)}/auth/${this.provider}/callback`;

      const authUrl = client.authorizationUrl({
        scope,
        redirect_uri: redirectUri,
        response_type: 'code',
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      });

      console.log(`🚀 Redirecting to Google...`);
      (req as any).res.redirect(authUrl);
      return null;
    }

    // Manejar callback (hay code)
    if (query.code) {
      const saved = session?.oidc?.[this.provider];

      if (!saved) {
        throw new Error('No OAuth state found in session');
      }

      try {
        const redirectUri = this.config.get<string>(`OIDC_REDIRECT_URI_${this.provider}`)
          || `http://localhost:${this.config.get('PORT', 3001)}/auth/${this.provider}/callback`;

        const tokenSet: TokenSet = await client.callback(
          redirectUri,
          { code: query.code as string, state: query.state as string },
          {
            state: saved.state,
            nonce: saved.nonce,
            code_verifier: saved.codeVerifier,
          }
        );

        const userinfo = tokenSet.access_token
          ? await client.userinfo(tokenSet.access_token)
          : undefined;

        const claims = tokenSet.claims();

        const user = {
          id: (claims.sub as string),
          name: (claims.name as string) || userinfo?.name,
          email: (claims.email as string) || userinfo?.email,
          picture: (claims.picture as string) || userinfo?.picture,
          identityProvider: 'oidc-google',
          provider: this.provider,
          roles: [],

          tokens: {
            access_token: tokenSet.access_token,
            id_token: tokenSet.id_token,
            refresh_token: tokenSet.refresh_token,
            expires_at: tokenSet.expires_at,
            token_type: tokenSet.token_type || 'Bearer',
          },

          claims,
          userinfo,
        };

        if (session?.oidc?.[this.provider]) {
          delete session.oidc[this.provider];
        }

        console.log(`✅ User authenticated: ${user.email}`);
        return user;

      } catch (error: any) {
        console.error(`❌ Error exchanging code:`, error.message);
        throw new Error(`Authentication failed: ${error.message}`);
      }
    }

    if (query.error) {
      throw new Error(`OAuth error: ${query.error} - ${query.error_description || 'No description'}`);
    }

    throw new Error('Invalid OAuth flow state');
  }
}
