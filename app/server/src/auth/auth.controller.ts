import { Controller, Post, Patch, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { AuthedRequest } from './authed-request';

class LoginDto {
  /** Username or email address — see AuthService.login. */
  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  // Same floor the coordinator's account-creation forms enforce.
  @IsString()
  @MinLength(8)
  newPassword!: string;
}

// No class-level guard: /auth/login must stay public. The guard goes on the
// individual handler that needs it.
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.identifier, dto.password);
  }

  /** Any signed-in user, any role, changing their own password. */
  @Patch('password')
  @UseGuards(AuthGuard('jwt'))
  async changePassword(
    @Req() req: AuthedRequest,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      req.user.userId,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
