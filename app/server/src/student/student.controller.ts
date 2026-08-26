import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { StudentService } from './student.service';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { AuthedRequest } from '../auth/authed-request';
import { EmptyToUndefined } from '../common/transforms';

class SubmitAttendanceDto {
  @IsDateString()
  date!: string;

  @IsOptional()
  @IsDateString()
  timeInAM?: string;

  @IsOptional()
  @IsDateString()
  timeOutAM?: string;

  @IsOptional()
  @IsDateString()
  timeInPM?: string;

  @IsOptional()
  @IsDateString()
  timeOutPM?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}

// Students may only ever touch these two fields on their own record — every
// other field (name, course, requiredHours, status, ...) is coordinator-owned.
// Declaring nothing else here is what makes forbidNonWhitelisted reject an
// attempt to slip one in.
class UpdateProfileDto {
  @IsOptional()
  @EmptyToUndefined()
  @Matches(/^\d{11}$/, {
    message: 'contactNumber must be exactly 11 digits (e.g. 09123456789)',
  })
  contactNumber?: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @MaxLength(255)
  address?: string;
}

@Controller('student')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('STUDENT')
export class StudentController {
  constructor(private studentService: StudentService) {}

  @Get('dashboard')
  getDashboard(@Req() req: AuthedRequest) {
    return this.studentService.getDashboard(req.user.userId);
  }

  @Post('attendance')
  submitAttendance(
    @Req() req: AuthedRequest,
    @Body() dto: SubmitAttendanceDto,
  ) {
    return this.studentService.submitAttendance(req.user.userId, dto);
  }

  @Get('attendance')
  getAttendanceHistory(@Req() req: AuthedRequest) {
    return this.studentService.getAttendanceHistory(req.user.userId);
  }

  @Get('profile')
  getProfile(@Req() req: AuthedRequest) {
    return this.studentService.getProfile(req.user.userId);
  }

  @Patch('profile')
  updateProfile(@Req() req: AuthedRequest, @Body() dto: UpdateProfileDto) {
    return this.studentService.updateProfile(req.user.userId, dto);
  }
}
