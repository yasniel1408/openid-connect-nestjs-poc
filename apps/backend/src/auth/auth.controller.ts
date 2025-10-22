import { Controller, Get, Req, Res, Inject } from '@nestjs/common';
import type { Request, Response } from 'express';
import { OidcService } from './oidc.service';

@Controller('auth')
export class AuthController {
  constructor(@Inject(OidcService) private readonly oidc: OidcService) {}

  @Get(':provider/login')
  async login(@Req() req: Request, @Res() res: Response) {
    const provider = (req as any).params.provider as string;
    const url = await this.oidc.getAuthUrl(provider, (req as any).session);
    return res.redirect(url);
  }

  @Get(':provider/callback')
  async callback(@Req() req: Request, @Res() res: Response) {
    try {
      const provider = (req as any).params.provider as string;
      const user = await this.oidc.handleCallback(provider, (req as any).query, (req as any).session);

      // Cookies públicas para el frontend (no sensibles)
      const cookieOpts = { httpOnly: false, sameSite: 'lax' as const, path: '/' };
      res.cookie('logged', 'true', { ...cookieOpts, maxAge: 60 * 60 * 1000 });

      const claims: any = user?.claims || {};
      const roles = (claims.roles as string[] | undefined)
        || (claims.groups as string[] | undefined)
        || (typeof claims.scp === 'string' ? (claims.scp as string).split(' ') : []);
      const userInfo = {
        id: (claims.oid as string) || (claims.sub as string),
        identityProvider: claims.iss as string,
        name: claims.name as string,
        email: (claims.email as string) || (claims.preferred_username as string),
        roles: roles || [],
        type: 1,
      };
      res.cookie('user_info', userInfo, { ...cookieOpts, maxAge: 60 * 60 * 1000 });

      const front = process.env.CORS_ORIGIN || 'http://localhost:3000';
      return res.redirect(front);
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || 'OIDC callback error' });
    }
  }

  @Get(':provider/logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    const sess: any = (req as any).session;
    const idToken = sess?.user?.tokens?.id_token;
    const provider = (req as any).params.provider as string;
    const front = process.env.CORS_ORIGIN || 'http://localhost:3000';
    if (sess) sess.destroy(() => {});
    const clearOpts = { path: '/', sameSite: 'lax' as const };
    res.clearCookie('logged', clearOpts);
    res.clearCookie('user_info', clearOpts);
    res.clearCookie('axis-cookie', clearOpts);
    if (idToken) {
      const url = await this.oidc.endSessionUrl(provider, idToken);
      return res.redirect(url);
    }
    return res.redirect(front);
  }
}
