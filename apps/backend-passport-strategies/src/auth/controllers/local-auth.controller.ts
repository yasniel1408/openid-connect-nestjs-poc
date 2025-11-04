import { Body, Controller, Post, Req, Res, UseGuards, Inject } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { GetTokenByUserService } from '../services/get-token-by-user.service';
import { CookieService } from '../services/cookie.service.js';
import { AuthConfigService } from '../services/auth-config.service';

@Controller('auth/local')
export class LocalAuthController {
  constructor(
    @Inject(GetTokenByUserService) private readonly getTokenByUser: GetTokenByUserService,
    @Inject(CookieService) private readonly publicCookieService: CookieService,
    @Inject(AuthConfigService) private readonly authConfig: AuthConfigService
  ) {}

  @Post('username')
  @UseGuards(AuthGuard('local-username'))
  async loginWithUsername(@Req() req: Request, @Res() res: Response, @Body() _body: any) {
    const user = req.user;

    // Guardar en sesión Redis
    if ((req as any).session) {
      (req as any).session.user = user;
    }

    // Establecer cookies públicas (logged, user_info)
    this.publicCookieService.setFromUser(res, user);

    // Generar JWT
    const token = await this.getTokenByUser.execute(user, 'local-username');

    // Establecer cookie con JWT
    this.publicCookieService.setLoggedIn(res, token, 'local-username');

    // Redirigir al frontend
    return res.redirect(this.authConfig.getCorsOrigin());
  }
}
