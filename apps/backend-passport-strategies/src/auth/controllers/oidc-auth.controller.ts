import { Controller, Get, Req, Res, Inject } from '@nestjs/common';
import type { Request, Response } from 'express';
import { OidcService } from '../services/oidc.service';
import { CookieService } from '../services/cookie.service.js';
import { AuthConfigService } from '../services/auth-config.service';

/**
 * Controller para autenticación OIDC (OAuth 2.0 + OpenID Connect)
 * Strategies: OidcPkceAzureStrategy, OidcPkceGoogleStrategy
 * 
 * Soporta múltiples providers:
 * - Azure AD
 * - Google
 * - Otros providers OIDC
 */
@Controller('auth')
export class OidcAuthController {
  constructor(
    @Inject(OidcService) private readonly oidc: OidcService,
    @Inject(CookieService) private readonly publicCookieService: CookieService,
    @Inject(AuthConfigService) private readonly authConfig: AuthConfigService
  ) {}

  /**
   * Iniciar flujo de autenticación con Azure AD
   * GET /auth/azure/login
   * 
   * Flow:
   * 1. Genera state, nonce, codeVerifier (PKCE)
   * 2. Guarda en sesión Redis
   * 3. Calcula codeChallenge
   * 4. Redirige a Azure con parámetros OAuth
   */
  @Get('azure/login')
  async azureLogin(@Req() req: Request, @Res() res: Response) {
    const url = await this.oidc.getAuthUrl('azure', (req as any).session);
    return res.redirect(url);
  }

  /**
   * Callback de Azure AD después del login
   * GET /auth/azure/callback?code=...&state=...
   * 
   * Flow:
   * 1. Valida state (anti-CSRF)
   * 2. Recupera codeVerifier de sesión
   * 3. Canjea code por tokens (access_token, id_token, refresh_token)
   * 4. Guarda user + tokens en sesión Redis
   * 5. Establece cookies
   * 6. Redirige al frontend
   */
  @Get('azure/callback')
  async azureCallback(@Req() req: Request, @Res() res: Response) {
    const user = await this.oidc.handleCallback('azure', (req as any).query, (req as any).session);
    this.publicCookieService.setFromUser(res, user, 'oidc-azure');
    return res.redirect(this.authConfig.getCorsOrigin());
  }

  /**
   * Iniciar flujo de autenticación con Google
   * GET /auth/google/login
   */
  @Get('google/login')
  async googleLogin(@Req() req: Request, @Res() res: Response) {
    const url = await this.oidc.getAuthUrl('google', (req as any).session);
    return res.redirect(url);
  }

  /**
   * Callback de Google después del login
   * GET /auth/google/callback?code=...&state=...
   */
  @Get('google/callback')
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const user = await this.oidc.handleCallback('google', (req as any).query, (req as any).session);
    this.publicCookieService.setFromUser(res, user, 'oidc-google');
    return res.redirect(this.authConfig.getCorsOrigin());
  }

  // Puedes agregar más providers aquí:
  // @Get('github/login') para GitHub
  // @Get('okta/login') para Okta
  // etc.
}
