import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  /**
   * `identifier` is a username or an email address.
   *
   * Students and supervisors get a generated username (common/credentials.ts),
   * but accounts created before usernames existed only have an email, so both
   * are accepted. Generated usernames are letters and digits only, and the old
   * typed ones were barred from "@", which is what stops one account's
   * username from shadowing another's email.
   */
  async login(identifier: string, password: string) {
    const user = await this.prisma.client.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid username or password');
    }

    return this.session(user);
  }

  /**
   * A signed token plus the user summary the client stores.
   *
   * `mcp` ("must change password") is added only when the flag is set, so an
   * ordinary token is byte-for-byte what it was before the flag existed.
   * RolesGuard reads it from the token rather than the database on every
   * request; that is why changing the password has to hand back a fresh token.
   */
  private async session(user: {
    id: string;
    email: string;
    username: string | null;
    name: string;
    role: string;
    mustChangePassword: boolean;
  }) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      ...(user.mustChangePassword ? { mcp: true } : {}),
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  /**
   * Changes the signed-in user's own password.
   *
   * Requires the current password even though the caller already holds a valid
   * JWT: the token proves the session, not that the person at the keyboard is
   * the account owner. Without this check, an unattended logged-in browser is
   * enough to lock the real owner out.
   *
   * Also the way out of a forced change: it clears `mustChangePassword`. The
   * current password is still required then — it is the temporary one the user
   * just signed in with — so a stolen must-change token alone can't set a
   * password.
   *
   * Returns a fresh session: the caller's token may carry `mcp`, and RolesGuard
   * would keep refusing it. The old token itself is not revoked (there is no
   * blocklist) and simply expires on its own.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException('Account not found');
    }

    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (await bcrypt.compare(newPassword, user.password)) {
      throw new BadRequestException(
        'New password must be different from the current one',
      );
    }

    const updated = await this.prisma.client.user.update({
      where: { id: userId },
      data: {
        password: await bcrypt.hash(newPassword, 10),
        mustChangePassword: false,
      },
    });

    return { changed: true, ...(await this.session(updated)) };
  }
}
