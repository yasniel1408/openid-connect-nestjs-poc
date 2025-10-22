import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class GetTokenByUserService {
  constructor(@Inject(JwtService) private readonly jwtService: JwtService) {}

  async execute(user: any, strategy: string) {
    const payload = {
      name: user.name,
      email: user.email,
      roles: user.roles || [],
      strategy,
    };

    return this.jwtService.signAsync(payload, {
      algorithm: 'HS256',
      issuer: 'axis-local',
      subject: user.id,
      expiresIn: '1h',
    });
  }
}
