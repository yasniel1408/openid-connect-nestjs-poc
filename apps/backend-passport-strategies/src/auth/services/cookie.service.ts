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
  private readonly COOKIE_LOGGED_NAME = 'logged';
  private readonly COOKIE_USER_INFO_NAME = 'user_info';
  private readonly COOKIE_AXIS_NAME = 'axis-session';
  private readonly COOKIE_AXIS_STRATEGY_NAME = 'axis-strategy';

  private readonly cookieOptions = { ...this.cookieOpts };

  setLoggedOut(res: Response) {
    res.cookie(this.COOKIE_LOGGED_NAME, 'false', this.cookieOptions);
    res.clearCookie(this.COOKIE_USER_INFO_NAME, this.cookieOptions);
    res.clearCookie(this.COOKIE_AXIS_NAME, this.cookieOptions);
    res.clearCookie(this.COOKIE_AXIS_STRATEGY_NAME, this.cookieOptions);
  }

  setLoggedIn(res: Response, session: string, strategy?: string, user?: UserLike | null) {
    res.cookie(this.COOKIE_AXIS_NAME, session, this.cookieOptions);
    if (!user) {
      this.setLoggedOut(res);
      return;
    }
    const axis_user = {
      id: user.id || user?.claims?.oid || user?.claims?.sub,
      identityProvider: user.identityProvider || user?.claims?.iss,
      name: user.name || user?.claims?.name,
      email: user.email || user?.claims?.email || user?.claims?.preferred_username,
      roles: user.roles || [],
      type: 1,
    };
    res.cookie(this.COOKIE_LOGGED_NAME, 'true', this.cookieOptions);
    res.cookie(this.COOKIE_USER_INFO_NAME, JSON.stringify				(axis_user), this.cookieOptions);
    strategy && res.cookie(this.COOKIE_AXIS_STRATEGY_NAME, strategy, this.cookieOptions);
  }
}
