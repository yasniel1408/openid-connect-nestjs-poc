import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { OidcService } from './oidc.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(OidcService) private readonly oidc: OidcService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authMode = (process.env.AUTH_MODE || 'oidc').toLowerCase();
    // 1) Sesión de backend (login via /auth/login)
    if ((req as any).session?.user) {
      return true;
    }
    // Compat: aceptar token mock si está habilitado
    const cookies = (req as any).cookies || {};
    const header = (req.headers['authorization'] as string | undefined) || '';
    const bearer = header.toLowerCase().startsWith('bearer ') ? header.slice('bearer '.length).trim() : undefined;
    const token = bearer || cookies['access_token'];
    if (!token) throw new UnauthorizedException('Missing access token');

    if (authMode === 'mock') {
      const expected = process.env.MOCK_ACCEPT_TOKEN || 'dev-token';
      if (token !== expected) throw new UnauthorizedException('Invalid mock token');
      req.user = { sub: 'mock-user', scope: 'read:products' };
      return true;
    }

    // OIDC token validation via remote JWKS (multi IdP)
    // resolver provider por iss del token
    let provider: string | undefined;
    try {
      const parts = token.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        provider = await this.oidc.providerFromIssuer(payload.iss as string);
      }
    } catch {}
    if (!provider) throw new UnauthorizedException('Unknown token issuer');

    const client = await this.oidc.getClient(provider);
    const jwksUri = client.issuer.metadata.jwks_uri;
    if (!jwksUri) throw new UnauthorizedException('Issuer missing jwks_uri');

    const JWKS = createRemoteJWKSet(new URL(jwksUri));
    const { audiences, relax } = this.oidc.getAudience(provider);
    try {
      // Debug: header/payload sin verificar (no imprimir token completo)
      try {
        const [h, p] = token.split('.');
        if (h && p) {
          const header = JSON.parse(Buffer.from(h, 'base64').toString('utf8'));
          const payload = JSON.parse(Buffer.from(p, 'base64').toString('utf8'));
          // eslint-disable-next-line no-console
          console.log('AuthGuard pre-verify:', {
            header: { kid: header.kid, alg: header.alg },
            claims: { iss: payload.iss, aud: payload.aud, azp: payload.azp, scp: payload.scp },
            expected: { issuer: client.issuer.issuer, audience: audiences },
          });
        }
      } catch {}

      const verifyOptions: any = { issuer: client.issuer.issuer };
      if (!relax && audiences.length > 0) {
        verifyOptions.audience = audiences.length <= 1 ? audiences[0] : audiences;
      }
      const { payload } = await jwtVerify(token, JWKS, verifyOptions);
      req.user = payload;
      return true;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('AuthGuard token verification failed:', err);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
