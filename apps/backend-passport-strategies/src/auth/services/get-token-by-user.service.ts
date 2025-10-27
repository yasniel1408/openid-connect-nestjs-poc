import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class GetTokenByUserService {
  constructor(@Inject(JwtService) private readonly jwtService: JwtService, @Inject(ConfigService) private readonly config: ConfigService) {}

  async execute(user: any, strategy: string) {
    const payload = {
      name: user.name,
      email: user.email,
      roles: user.roles || [],
      strategy,
    };

    return this.jwtService.signAsync(payload, {
      algorithm: 'HS256',
      issuer: this.config.get<string>('JWT_ISSUER', 'axis-backend'),
      audience: this.config.get<string>('JWT_AUDIENCE', 'axis-api'),
      subject: user.id,
      expiresIn: '1h',
    });
  }
}
