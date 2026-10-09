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
  validate(payload: {
    sub: string;
    email: string;
    role: string;
    mcp?: boolean;
  }): JwtUser {
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      // Absent on every token issued without the flag, including all tokens
      // from before it existed — those read as false.
      mustChangePassword: payload.mcp === true,
    };
  }
}
