import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';

const USERS = [
  { id: 'c1', code: '12345678', password: 'codepass', name: 'Code User', email: 'code.user@demo.com', roles: ['human'] },
];

@Injectable()
export class LocalCodeStrategy extends PassportStrategy(Strategy, 'human-code') {
  constructor() {
    super({ usernameField: 'code', passwordField: 'password', passReqToCallback: false });
  }

  async validate(code: string, password: string) {
    const u = USERS.find((x) => x.code === code && x.password === password);
    if (!u) return null;
    return { id: u.id, name: u.name, email: u.email, roles: u.roles, identityProvider: 'human-code' };
  }
}
