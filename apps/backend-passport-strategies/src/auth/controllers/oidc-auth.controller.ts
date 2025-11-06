import { Controller, Get, Req, Res, UseGuards, Inject } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { CookieService } from '../services/cookie.service.js';
import { ConfigService } from '@nestjs/config';
import { GetTokenByUserService } from '../services/get-token-by-user.service';

@Controller('auth')
export class OidcAuthController {
  constructor(
    @Inject(CookieService) private readonly cookieService: CookieService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(GetTokenByUserService) private readonly getTokenByUser: GetTokenByUserService
  ) {}

  @Get('azure/login')
  @UseGuards(AuthGuard('oidc-azure'))
  async azureLogin() {
  }
  @Get('azure/callback')
  @UseGuards(AuthGuard('oidc-azure'))
  async azureCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as any;
    if ((req as any).session) {
      (req as any).session.user = user;
    }
    this.cookieService.setLoggedIn(res, 'oidc-azure', user);
    return res.redirect(this.config.get<string>('CORS_ORIGIN') || 'http://localhost:3000');
  }


  @Get('google/login')
  @UseGuards(AuthGuard('oidc-google'))
  async googleLogin() {
  }
  @Get('google/callback')
  @UseGuards(AuthGuard('oidc-google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as any;
    if ((req as any).session) {
      (req as any).session.user = user;
    }
    this.cookieService.setLoggedIn(res, 'oidc-google', user);
    return res.redirect(this.config.get<string>('CORS_ORIGIN') || 'http://localhost:3000');
  }
}
