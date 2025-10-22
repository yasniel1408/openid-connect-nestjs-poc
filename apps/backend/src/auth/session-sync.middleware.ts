import type { NextFunction, Request, Response } from 'express';

export class SessionSyncMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const sess: any = (req as any).session;
    const user = sess?.user;

    const cookieOpts = { httpOnly: false, sameSite: 'lax' as const, path: '/' };

    if (user) {
      // logged=true y user_info desde sesión
      res.cookie('logged', 'true', { ...cookieOpts, maxAge: 60 * 60 * 1000 });
      const claims: any = user.claims || {};
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
      const encoded = Buffer.from(JSON.stringify(userInfo)).toString('base64url');
      res.cookie('user_info', encoded, { ...cookieOpts, maxAge: 60 * 60 * 1000 });
    } else {
      // Sin sesión: logged=false y limpiar user_info
      res.cookie('logged', 'false', { ...cookieOpts, maxAge: 60 * 60 * 1000 });
      res.clearCookie('user_info', { path: '/', sameSite: 'lax' as const });
    }

    next();
  }
}

