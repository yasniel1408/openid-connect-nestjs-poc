import { Injectable } from '@nestjs/common';
import type { Response } from 'express';

type UserLike = {
  id?: string;
  name?: string;
  email?: string;
  roles?: string[];
  identityProvider?: string;
  claims?: Record<string, any>;
};

@Injectable()
export class CookieService {
  private readonly cookieOpts = { httpOnly: false, sameSite: 'lax' as const, path: '/' };
  private readonly maxAgeMs = 60 * 60 * 1000;
  private readonly COOKIE_LOGGED_NAME = 'logged';
  private readonly COOKIE_USER_INFO_NAME = 'user_info';
  private readonly COOKIE_AXIS_NAME = 'axis-session';
  private readonly COOKIE_AXIS_STRATEGY_NAME = 'axis-strategy';

  setLoggedOut(res: Response) {
    res.cookie(this.COOKIE_LOGGED_NAME, 'false', { ...this.cookieOpts, maxAge: this.maxAgeMs });
    res.clearCookie(this.COOKIE_USER_INFO_NAME, { path: '/', sameSite: 'lax' });
    res.clearCookie(this.COOKIE_AXIS_NAME, { path: '/', sameSite: 'lax' });
    res.clearCookie(this.COOKIE_AXIS_STRATEGY_NAME, { path: '/', sameSite: 'lax' });
  }

  setLoggedIn(res: Response, session: string, strategy: string) {
    res.cookie(this.COOKIE_AXIS_NAME, session, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: this.maxAgeMs });
    res.cookie(this.COOKIE_AXIS_STRATEGY_NAME, strategy, { httpOnly: false, sameSite: 'lax', path: '/', maxAge: this.maxAgeMs });
  }

  setFromUser(res: Response, user: UserLike | null | undefined, strategy: string | undefined = undefined) {
    if (!user) {
      this.setLoggedOut(res);
      return;
    }
    const info = {
      id: user.id || user?.claims?.oid || user?.claims?.sub,
      identityProvider: user.identityProvider || user?.claims?.iss,
      name: user.name || user?.claims?.name,
      email: user.email || user?.claims?.email || user?.claims?.preferred_username,
      roles: user.roles || [],
      type: 1,
    };
    const encoded = Buffer.from(JSON.stringify(info)).toString('base64url');
    res.cookie(this.COOKIE_LOGGED_NAME, 'true', { ...this.cookieOpts, maxAge: this.maxAgeMs });
    res.cookie(this.COOKIE_USER_INFO_NAME, encoded, { ...this.cookieOpts, maxAge: this.maxAgeMs });
    strategy && res.cookie(this.COOKIE_AXIS_STRATEGY_NAME, strategy, { httpOnly: false, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 1000 });
  }
}
