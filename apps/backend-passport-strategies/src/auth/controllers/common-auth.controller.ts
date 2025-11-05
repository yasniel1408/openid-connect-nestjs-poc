import { Body, Controller, Get, Post, Req, Res, Inject } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CookieService } from '../services/cookie.service.js';
import { ConfigService } from '@nestjs/config';
import { CceTokenService } from '../services/cce.service.js';
import { Session } from 'express-session';

@Controller('auth')
export class CommonAuthController {
  constructor(
    @Inject(CookieService) private readonly publicCookieService: CookieService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(CceTokenService) private readonly cceTokenService: CceTokenService
  ) {}

  @Get('ping')
  async ping(@Req() req: Request, @Res() res: Response) {
    const session: any = (req as any).session;

    if (!session['user']) {
      if (session) session.destroy(() => {});
      this.publicCookieService.setLoggedOut(res);
      return res.status(401).json({
        message: 'pong',
        session: { active: false }
      });
    }

    // ✅ Touch renueva el TTL de Redis automáticamente
    session.touch();

    // Guardar la sesión actualizada en Redis
    return res.status(200).json({
      message: 'pong',
      session: { active: true }
    });
  }

  @Get('user_info')
  userInfo(@Req() req: Request) {
    return (req as any).user || (req as any).session?.user || null;
  }

  @Get('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    const session: any = (req as any).session;
    if (session) session.destroy(() => {});
    this.publicCookieService.setLoggedOut(res);
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
