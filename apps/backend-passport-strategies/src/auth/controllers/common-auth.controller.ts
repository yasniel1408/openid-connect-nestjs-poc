import { Body, Controller, Get, Post, Req, Res, Inject } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CookieService } from '../services/cookie.service.js';
import { ConfigService } from '@nestjs/config';
import { CceTokenService } from '../services/cce.service.js';

/**
 * Controller para endpoints comunes de autenticación
 * - Información del usuario autenticado
 * - Logout
 * - Client Credentials (para sistemas/servicios)
 */
@Controller('auth')
export class CommonAuthController {
  constructor(
    @Inject(CookieService) private readonly publicCookieService: CookieService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(CceTokenService) private readonly cceTokenService: CceTokenService
  ) {}

  /**
   * Obtener información del usuario autenticado
   * GET /auth/me
   *
   * Retorna el usuario de la sesión actual
   * No requiere guard específico, busca en req.user o req.session
   */
  @Get('me')
  me(@Req() req: Request) {
    return (req as any).user || (req as any).session?.user || null;
  }

  /**
   * Cerrar sesión (Logout)
   * GET /auth/logout
   *
   * Flow:
   * 1. Destruye sesión en Redis
   * 2. Limpia cookies del navegador
   * 3. Si es OIDC (Azure/Google), redirige a endpoint de logout del provider
   * 4. Si es local, redirige al frontend
   */
  @Get('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    const sess: any = (req as any).session;
    const provider = sess?.user?.provider as string | undefined;
    const idToken = sess?.user?.tokens?.id_token as string | undefined;

    // Destruir sesión en Redis
    if (sess) sess.destroy(() => {});

    // Limpiar cookies
    this.publicCookieService.setLoggedOut(res);

    // Redirigir al frontend
    return res.redirect(this.config.get<string>('CORS_ORIGIN') || 'http://localhost:3000');
  }

  /**
   * Obtener token de Client Credentials (OAuth 2.0)
   * POST /auth/system/cc/token
   *
   * Para autenticación de servicio-a-servicio (machine-to-machine)
   * No requiere usuario, usa client_id y client_secret
   *
   * Body: { scope?: string }
   *
   * Use case:
   * - Backend necesita llamar a API de Azure
   * - Servicio necesita acceso a recursos sin usuario
   * - Cron jobs que necesitan autenticación
   */
  @Post('system/cc/token')
  async ccToken(@Req() req: Request, @Res() res: Response, @Body() body: any) {
    try {
      const result = await this.cceTokenService.getClientCredentialsToken({
        provider: 'azure',
        scope: body?.scope,
      });
      const status = 'error' in result ? 400 : 200;
      return res.status(status).json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'token fetch failed' });
    }
  }
}
