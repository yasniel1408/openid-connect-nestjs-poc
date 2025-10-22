import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';

const USERS = [
  { id: 'e1', email: 'user@demo.com', password: 'demo123', name: 'Email User', roles: ['user'] },
];

@Injectable()
export class LocalEmailStrategy extends PassportStrategy(Strategy, 'local-email') {
  constructor() {
    super({ usernameField: 'email', passwordField: 'password', passReqToCallback: false });
  }

  async validate(email: string, password: string) {
    const u = USERS.find((x) => x.email === email && x.password === password);
    if (!u) return null;
    return { id: u.id, name: u.name, email: u.email, roles: u.roles, identityProvider: 'local-email' };
  }
}
