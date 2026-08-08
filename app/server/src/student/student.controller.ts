import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { StudentService } from './student.service';
import { Roles, RolesGuard } from '../auth/roles.guard';

class SubmitAttendanceDto {
  date!: string;
  timeInAM?: string;
  timeOutAM?: string;
  timeInPM?: string;
  timeOutPM?: string;
  remarks?: string;
}

@Controller('student')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('STUDENT')
export class StudentController {
  constructor(private studentService: StudentService) {}

  @Get('dashboard')
  getDashboard(@Req() req: any) {
    return this.studentService.getDashboard(req.user.userId);
  }

  @Post('attendance')
  submitAttendance(@Req() req: any, @Body() dto: SubmitAttendanceDto) {
    return this.studentService.submitAttendance(req.user.userId, dto);
  }

  @Get('attendance')
  getAttendanceHistory(@Req() req: any) {
    return this.studentService.getAttendanceHistory(req.user.userId);
  }
}
