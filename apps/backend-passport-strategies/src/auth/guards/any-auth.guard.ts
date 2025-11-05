import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ExtractJwt } from 'passport-jwt';
import { cookieExtractor } from '../strategies/jwt.strategy';

@Injectable()
export class AnyAuthGuard implements CanActivate {
  private readonly cceGuard = new (AuthGuard('azure-cce-jwt'))();
  private readonly jwtGuard = new (AuthGuard('jwt'))();

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    // Session PKCE
    if (req.isAuthenticated()) return true;
    if (req.user) return true;
    if (req.session.user) return true;

    // Session JWT
    const sessionToken = ExtractJwt.fromExtractors([cookieExtractor])(req);
    if (sessionToken) {
      const ok = await (this.jwtGuard.canActivate(context) as Promise<boolean>);
      if (ok) return true;
    }

    // Bearer JWT CCE
    const cceToken = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    if (cceToken) {
      const ok = await (this.cceGuard.canActivate(context) as Promise<boolean>);
      if (ok) return true;
    }
    return false
  }
}
