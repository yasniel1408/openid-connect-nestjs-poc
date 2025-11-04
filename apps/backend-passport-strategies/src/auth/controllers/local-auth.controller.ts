import { Body, Controller, Post, Req, Res, UseGuards, Inject } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { GetTokenByUserService } from '../services/get-token-by-user.service';
import { CookieService } from '../services/cookie.service.js';

@Controller('auth/local')
export class LocalAuthController {
  constructor(
    @Inject(GetTokenByUserService) private readonly getTokenByUser: GetTokenByUserService,
    @Inject(CookieService) private readonly publicCookieService: CookieService,
    @Inject(ConfigService) private readonly config: ConfigService
  ) {}

  @Post('login')
  @UseGuards(AuthGuard('local-session'))
  async login(@Req() req: Request, @Res() res: Response, @Body() _body: any) {
    const user = req.user;

    // Guardar en sesión Redis
    if ((req as any).session) {
      (req as any).session.user = user;
    }

    // Establecer cookies públicas (logged, user_info)
    this.publicCookieService.setFromUser(res, user);

    // Generar JWT
    const token = await this.getTokenByUser.execute(user, 'local-session');

    // Establecer cookie con JWT
    this.publicCookieService.setLoggedIn(res, token, 'local-session');

    // Redirigir al frontend
    const corsOrigin = this.config.get<string>('CORS_ORIGIN') || 'http://localhost:3000';
    return res.redirect(corsOrigin);
  }
}
