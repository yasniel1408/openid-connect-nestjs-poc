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
export class PublicCookieService {
  private readonly cookieOpts = { httpOnly: false, sameSite: 'lax' as const, path: '/' };
  private readonly maxAgeMs = 60 * 60 * 1000;

  setLoggedOut(res: Response) {
    res.cookie('logged', 'false', { ...this.cookieOpts, maxAge: this.maxAgeMs });
    res.clearCookie('user_info', { path: '/', sameSite: 'lax' });
  }

  setFromUser(res: Response, user: UserLike | null | undefined) {
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
    res.cookie('logged', 'true', { ...this.cookieOpts, maxAge: this.maxAgeMs });
    res.cookie('user_info', encoded, { ...this.cookieOpts, maxAge: this.maxAgeMs });
  }
}
