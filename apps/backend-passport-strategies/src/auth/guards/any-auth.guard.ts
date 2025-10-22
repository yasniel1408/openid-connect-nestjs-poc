import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class AnyAuthGuard extends AuthGuard('oidc-azure-cce') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const headers = (req.headers || {}) as Record<string, string | string[]>;
    const headerValue = headers['authorization'];
    const authorization = typeof headerValue === 'string' ? headerValue : undefined;

    const hasPassportSession = typeof req.isAuthenticated === 'function' ? req.isAuthenticated() : false;
    if (hasPassportSession) return true;
    if (req.user) return true;
    if (req.session?.user) {
      req.user = req.session.user;
      return true;
    }

    if (authorization?.toLowerCase().startsWith('bearer ')) {
      const result = await super.canActivate(context);
      return Boolean(result);
    }

    return false;
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      const message = err?.message ?? info?.message ?? 'Unauthorized';
      // eslint-disable-next-line no-console
      console.warn('Azure bearer validation failed:', message);
      throw err ?? new UnauthorizedException(message);
    }
    return user;
  }
}
