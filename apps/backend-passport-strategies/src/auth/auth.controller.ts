import { Body, Controller, Get, Post, Req, Res, UseGuards, Inject } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { OidcService } from './services/oidc.service';
import { GetTokenByUserService } from './services/get-token-by-user.service';
import { PublicCookieService } from './services/public-cookie.service';
import { AuthConfigService } from './services/auth-config.service';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(OidcService) private readonly oidc: OidcService,
    @Inject(GetTokenByUserService) private readonly getTokenByUser: GetTokenByUserService,
    @Inject(PublicCookieService) private readonly publicCookieService: PublicCookieService,
    @Inject(AuthConfigService) private readonly authConfig: AuthConfigService,
  ) {}
  // Local username/password
  @Post('local/username')
  @UseGuards(AuthGuard('local-username'))
  async localUsername(@Req() req: Request, @Res() res: Response, @Body() _body: any) {
    const user = (req as any).user;
    this.publicCookieService.setFromUser(res, user);
    const token = await this.getTokenByUser.execute(user, 'local-username');
    // axis-session como JWT (httpOnly)
    res.cookie('axis-session', token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 1000 });
    res.cookie('axis-strategy', 'local-username', { httpOnly: false, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 1000 });
    return res.redirect(this.authConfig.getCorsOrigin());
  }

  // Local email/password
  @Post('local/email')
  @UseGuards(AuthGuard('local-email'))
  async localEmail(@Req() req: Request, @Res() res: Response, @Body() _body: any) {
    const user = (req as any).user;
    this.publicCookieService.setFromUser(res, user);
    const token = await this.getTokenByUser.execute(user, 'local-email');
    res.cookie('axis-session', token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 1000 });
    res.cookie('axis-strategy', 'local-email', { httpOnly: false, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 1000 });
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
    this.publicCookieService.setFromUser(res, user);
    res.cookie('axis-strategy', 'oidc-azure', { httpOnly: false, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 1000 });
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
    this.publicCookieService.setFromUser(res, user);
    res.cookie('axis-strategy', 'oidc-google', { httpOnly: false, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 1000 });
    return res.redirect(this.authConfig.getCorsOrigin());
  }

  // Human code/password
  @Post('human/code')
  @UseGuards(AuthGuard('human-code'))
  async humanCode(@Req() req: Request, @Res() res: Response) {
    const user = (req as any).user;
    this.publicCookieService.setFromUser(res, user);
    const token = await this.getTokenByUser.execute(user, 'human-code');
    res.cookie('axis-session', token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 1000 });
    res.cookie('axis-strategy', 'human-code', { httpOnly: false, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 1000 });
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
    this.publicCookieService.setFromUser(res, null);
    // limpiar cookies generales
    const clear = { path: '/', sameSite: 'lax' as const };
    res.clearCookie('axis-session', clear);
    res.clearCookie('axis-strategy', clear);
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
      const { issuer, clientId, clientSecret } = this.authConfig.getAzureCredentials();
      if (!issuer || !clientId || !clientSecret) {
        return res.status(400).json({ error: 'Missing Azure OIDC credentials on backend' });
      }
      const base = issuer.replace(/\/v2\.0$/, '');
      const tokenUrl = `${base}/oauth2/v2.0/token`;
      const scope = body?.scope || 'https://graph.microsoft.com/.default';
      const params = new URLSearchParams();
      params.set('grant_type', 'client_credentials');
      params.set('client_id', clientId);
      params.set('client_secret', clientSecret);
      params.set('scope', scope);
      const r = await fetch(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
      const json = await r.json().catch(() => ({}));
      return res.status(r.status).json(json);
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'token fetch failed' });
    }
  }
}
