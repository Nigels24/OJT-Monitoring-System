import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { getJwtSecret } from './jwt.constants';
import type { JwtUser } from './authed-request';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  // Passport accepts a sync return here; there is nothing to await.
  // Whatever this returns becomes `req.user` — see AuthedRequest.
  validate(payload: { sub: string; email: string; role: string }): JwtUser {
    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}
