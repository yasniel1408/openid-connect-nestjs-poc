import { SignJWT } from 'jose';
import { ConfigService } from '@nestjs/config';
import { Injectable, Inject } from '@nestjs/common';

@Injectable()
export class GetTokenByUserService {
    constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

    async execute(user: any, strategy: string) {
      const secret = this.configService.getOrThrow('SESSION_SECRET');
      const key = new TextEncoder().encode(secret);
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        sub: user.id,
        name: user.name,
        email: user.email,
        roles: user.roles || [],
        iss: 'axis-local',
        strategy,
      };
      const jwt = await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt(now)
        .setExpirationTime(now + 60 * 60) // 1h
        .sign(key);
      return jwt;
    }
}
