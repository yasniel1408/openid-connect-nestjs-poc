import { Body, Controller, Post, Req, Res, UseGuards, Inject } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { CookieService } from '../services/cookie.service.js';

@Controller('auth/local')
export class LocalAuthController {
  constructor(
    @Inject(CookieService) private readonly publicCookieService: CookieService,
    @Inject(ConfigService) private readonly config: ConfigService
  ) {}

  @Post('login')
  @UseGuards(AuthGuard('local-session'))
  async login(@Req() req: Request, @Res() res: Response, @Body() _body: any) {
    const user = req.user;
    if ((req as any).session) {
      (req as any).session.user = user;
    }
    this.publicCookieService.setLoggedIn(res, 'local-session', user);
    const corsOrigin = this.config.get<string>('CORS_ORIGIN') || 'http://localhost:3000';
    return res.redirect(corsOrigin);
  }
}
