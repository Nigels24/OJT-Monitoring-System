import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
import { StudentService } from './student.service';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { AuthedRequest } from '../auth/authed-request';

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
}
