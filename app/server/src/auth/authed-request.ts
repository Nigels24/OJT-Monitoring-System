import type { Request } from 'express';

/**
 * What `JwtStrategy.validate` puts on the request. Note the field is `userId`,
 * not `id` — it is the JWT's `sub` claim renamed, and every service takes it as
 * the argument it re-derives ownership from.
 */
export interface JwtUser {
  userId: string;
  email: string;
  role: string;
}

/**
 * Use this instead of `@Req() req: any` in any handler behind
 * `AuthGuard('jwt')`. Typing it is what keeps `req.user.userId` from being an
 * unchecked `any` access all the way into the service layer.
 */
export interface AuthedRequest extends Request {
  user: JwtUser;
}
