import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ExtractJwt } from 'passport-jwt';

@Injectable()
export class AnyAuthGuard implements CanActivate {
  // AuthGuard(...) devuelve una clase mixin. Hay que instanciarla.
  private readonly cceGuard = new (AuthGuard('azure-cce-jwt'))();

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    // Sesión (passport session / OIDC web)
    if (req.isAuthenticated()) return true;
    if (req.user) return true;
    if (req.session.user) return true;

    // Bearer JWT (Entra ID)
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    if (token) {
      const ok = await (this.cceGuard.canActivate(context) as Promise<boolean>);
      if (ok) return true; // strategy ya pobló req.user si es válido
    }
    return false
  }
}
