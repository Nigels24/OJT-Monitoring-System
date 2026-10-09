import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthedRequest } from './authed-request';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

/** The `code` a client reads to open the forced change-password dialog. */
export const PASSWORD_CHANGE_REQUIRED = 'PASSWORD_CHANGE_REQUIRED';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthedRequest>();

    // Checked first, before the "no @Roles means any signed-in user" early
    // return below — otherwise open reads (GET /establishments) and the whole
    // of /messages, which declare no roles, would let a must-change session
    // through. Every protected controller attaches this guard; the one route
    // that must stay reachable, PATCH /auth/password, attaches only
    // AuthGuard('jwt') and so never gets here.
    if (request.user?.mustChangePassword) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: PASSWORD_CHANGE_REQUIRED,
        message: 'You must change your temporary password before continuing.',
      });
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;

    return requiredRoles.includes(request.user?.role);
  }
}
