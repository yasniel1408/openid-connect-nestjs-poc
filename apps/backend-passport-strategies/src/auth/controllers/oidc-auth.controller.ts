import { Controller, Get, Req, Res, UseGuards, Inject } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { CookieService } from '../services/cookie.service.js';
import { AuthConfigService } from '../services/auth-config.service';
import { GetTokenByUserService } from '../services/get-token-by-user.service';

/**
 * Controller para autenticación OIDC (OAuth 2.0 + OpenID Connect)
 *
 * ✨ REFACTORIZADO: Usa Guards de Passport directamente
 *
 * Strategies: OidcPkceAzureStrategy, OidcPkceGoogleStrategy
 *
 * Passport maneja automáticamente:
 * - Redirect a provider (Azure/Google)
 * - Callback con authorization code
 * - Validación de state (CSRF protection)
 * - Exchange code por tokens
 * - Población de req.user
 *
 * Soporta múltiples providers:
 * - Azure AD
 * - Google
 * - Extensible a otros (GitHub, Okta, etc.)
 */
@Controller('auth')
export class OidcAuthController {
  constructor(
    @Inject(CookieService) private readonly cookieService: CookieService,
    @Inject(AuthConfigService) private readonly authConfig: AuthConfigService,
    @Inject(GetTokenByUserService) private readonly getTokenByUser: GetTokenByUserService
  ) {}

  // ==========================================
  // AZURE AD (Microsoft Entra ID)
  // ==========================================

  /**
   * Iniciar flujo OAuth con Azure AD
   * GET /auth/azure/login
   *
   * El guard 'oidc-azure' automáticamente:
   * 1. Redirige al usuario a Azure login
   * 2. Incluye parámetros OAuth (client_id, redirect_uri, scope, state, nonce)
   * 3. Passport guarda state/nonce en sesión para validación posterior
   *
   * No necesitas implementar nada más, Passport hace todo.
   */
  @Get('azure/login')
  @UseGuards(AuthGuard('oidc-azure'))
  async azureLogin() {
    // Este método nunca se ejecuta directamente
    // El guard redirige al usuario a Azure antes de llegar aquí
  }

  /**
   * Callback de Azure AD
   * GET /auth/azure/callback?code=...&state=...
   *
   * El guard 'oidc-azure' automáticamente:
   * 1. Valida state (anti-CSRF)
   * 2. Canjea authorization code por tokens
   * 3. Obtiene user info
   * 4. Llama a strategy.validate() que popula req.user
   * 5. Guarda user en sesión (via passport.serializeUser)
   *
   * Aquí solo necesitas:
   * - Establecer cookies públicas
   * - Redirigir al frontend
   */
  @Get('azure/callback')
  @UseGuards(AuthGuard('oidc-azure'))
  async azureCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as any;
    console.log('✅ Azure login exitoso:', user?.email);

    // Guardar user completo en sesión (incluye tokens si los guardaste en la strategy)
    if ((req as any).session) {
      (req as any).session.user = user;
    }

    // Generar JWT para el frontend (opcional)
    const token = await this.getTokenByUser.execute(user, 'oidc-azure');

    // Establecer cookies públicas
    this.cookieService.setFromUser(res, user);
    this.cookieService.setLoggedIn(res, token, 'oidc-azure');

    // Redirigir al frontend
    return res.redirect(this.authConfig.getCorsOrigin());
  }

  // ==========================================
  // GOOGLE
  // ==========================================

  /**
   * Iniciar flujo OAuth con Google
   * GET /auth/google/login
   */
  @Get('google/login')
  @UseGuards(AuthGuard('oidc-google'))
  async googleLogin() {
    // El guard redirige a Google automáticamente
  }

  /**
   * Callback de Google
   * GET /auth/google/callback?code=...&state=...
   */
  @Get('google/callback')
  @UseGuards(AuthGuard('oidc-google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as any;
    console.log('✅ Google login exitoso:', user?.email);

    // Guardar user en sesión
    if ((req as any).session) {
      (req as any).session.user = user;
    }

    // Generar JWT
    const token = await this.getTokenByUser.execute(user, 'oidc-google');

    // Establecer cookies
    this.cookieService.setFromUser(res, user);
    this.cookieService.setLoggedIn(res, token, 'oidc-google');

    // Redirigir al frontend
    return res.redirect(this.authConfig.getCorsOrigin());
  }

  // ==========================================
  // AGREGAR MÁS PROVIDERS ES FÁCIL
  // ==========================================

  // Ejemplo para GitHub:
  // 1. Crear GitHubStrategy en strategies/
  // 2. Registrar en auth.module.ts
  // 3. Agregar aquí:
  //
  // @Get('github/login')
  // @UseGuards(AuthGuard('oidc-github'))
  // async githubLogin() {}
  //
  // @Get('github/callback')
  // @UseGuards(AuthGuard('oidc-github'))
  // async githubCallback(@Req() req, @Res() res) {
  //   const user = req.user;
  //   // mismo código de arriba
  // }
}
