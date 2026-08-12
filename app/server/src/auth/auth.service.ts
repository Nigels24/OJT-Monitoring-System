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
   * Coordinators issue usernames to students and supervisors, but accounts
   * created before usernames existed only have an email, so both are accepted.
   * Usernames are barred from containing "@" (see CreateStudentDto), which is
   * what stops one account's username from shadowing another's email.
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

    const payload = { sub: user.id, email: user.email, role: user.role };

    const token = await this.jwtService.signAsync(payload);

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        role: user.role,
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
   * There is no token-expiry story here — the existing JWT stays valid until it
   * expires on its own, since there is no refresh flow or token blocklist.
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

    await this.prisma.client.user.update({
      where: { id: userId },
      data: { password: await bcrypt.hash(newPassword, 10) },
    });

    return { changed: true };
  }
}
