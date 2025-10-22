import { Body, Controller, Get, Post, Req, Res, UseGuards, Inject } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { OidcService } from './services/oidc.service';
import { GetTokenByUserService } from './services/get-token-by-user.service';
import { CookieService } from './services/cookie.service.js';
import { AuthConfigService } from './services/auth-config.service';
import { CceTokenService } from './services/cce.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(OidcService) private readonly oidc: OidcService,
    @Inject(GetTokenByUserService) private readonly getTokenByUser: GetTokenByUserService,
    @Inject(CookieService) private readonly publicCookieService: CookieService,
    @Inject(AuthConfigService) private readonly authConfig: AuthConfigService,
    @Inject(CceTokenService) private readonly cceTokenService: CceTokenService
  ) {}
  // Local username/password
  @Post('local/username')
  @UseGuards(AuthGuard('local-username'))
  async localUsername(@Req() req: Request, @Res() res: Response, @Body() _body: any) {
    const user = (req as any).user;
    if ((req as any).session) {
      (req as any).session.user = user;
    }
    this.publicCookieService.setFromUser(res, user);
    const token = await this.getTokenByUser.execute(user, 'local-username');
    this.publicCookieService.setLoggedIn(res,token,'local-username')
    return res.redirect(this.authConfig.getCorsOrigin());
  }

  // Local email/password
  @Post('local/email')
  @UseGuards(AuthGuard('local-email'))
  async localEmail(@Req() req: Request, @Res() res: Response, @Body() _body: any) {
    const user = (req as any).user;
    if ((req as any).session) {
      (req as any).session.user = user;
    }
    this.publicCookieService.setFromUser(res, user);
    const token = await this.getTokenByUser.execute(user, 'local-email');
    this.publicCookieService.setLoggedIn(res,token,'local-email')
    return res.redirect(this.authConfig.getCorsOrigin());
  }

  // OIDC Azure con openid-client
  @Get('azure/login')
  async azureLogin(@Req() req: Request, @Res() res: Response) {
    const url = await this.oidc.getAuthUrl('azure', (req as any).session);
    return res.redirect(url);
  }
  @Get('azure/callback')
  async azureCallback(@Req() req: Request, @Res() res: Response) {
    const user = await this.oidc.handleCallback('azure', (req as any).query, (req as any).session);
    this.publicCookieService.setFromUser(res, user, 'oidc-azure');
    return res.redirect(this.authConfig.getCorsOrigin());
  }

  // OIDC Google con openid-client
  @Get('google/login')
  async googleLogin(@Req() req: Request, @Res() res: Response) {
    const url = await this.oidc.getAuthUrl('google', (req as any).session);
    return res.redirect(url);
  }
  @Get('google/callback')
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const user = await this.oidc.handleCallback('google', (req as any).query, (req as any).session);
    this.publicCookieService.setFromUser(res, user, 'oidc-google');
    return res.redirect(this.authConfig.getCorsOrigin());
  }

  // Human code/password
  @Post('human/code')
  @UseGuards(AuthGuard('human-code'))
  async humanCode(@Req() req: Request, @Res() res: Response) {
    const user = (req as any).user;
    if ((req as any).session) {
      (req as any).session.user = user;
    }
    this.publicCookieService.setFromUser(res, user);
    const token = await this.getTokenByUser.execute(user, 'human-code');
    this.publicCookieService.setLoggedIn(res, token, 'human-code');
    return res.redirect(this.authConfig.getCorsOrigin());
  }


  @Get('me')
  me(@Req() req: Request) {
    return (req as any).user || (req as any).session?.user || null;
  }

  @Get('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    const sess: any = (req as any).session;
    const provider = sess?.user?.provider as string | undefined;
    const idToken = sess?.user?.tokens?.id_token as string | undefined;
    if (sess) sess.destroy(() => {});
    this.publicCookieService.setLoggedOut(res);
    if (provider && idToken) {
      try {
        const url = await this.oidc.endSessionUrl(provider, idToken);
        return res.redirect(url);
      } catch {}
    }
    return res.redirect(this.authConfig.getCorsOrigin());
  }

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
