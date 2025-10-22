import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';

// Mock store
const USERS = [
  { id: 'u1', username: 'axis', password: 'axis123', name: 'Axis User', email: 'axis@example.com', roles: ['user'] },
];

@Injectable()
export class LocalUsernameStrategy extends PassportStrategy(Strategy, 'local-username') {
  constructor() {
    super({ usernameField: 'username', passwordField: 'password', passReqToCallback: false });
  }

  async validate(username: string, password: string) {
    const u = USERS.find((x) => x.username === username && x.password === password);
    if (!u) return null;
    return { id: u.id, name: u.name, email: u.email, roles: u.roles, identityProvider: 'local-username' };
  }
}

