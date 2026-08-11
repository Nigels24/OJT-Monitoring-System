import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { SupervisorService } from './supervisor.service';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { EmptyToUndefined } from '../common/transforms';

class AttendanceQueryDto {
  @IsOptional()
  @EmptyToUndefined()
  @IsIn(['PENDING', 'APPROVED', 'DECLINED'])
  status?: 'PENDING' | 'APPROVED' | 'DECLINED';
}

class DeclineAttendanceDto {
  // Required: a declined log with no explanation gives the student nothing to
  // act on. The prototype enforces this in the UI; enforce it on the server too.
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

class CreateEvaluationDto {
  @IsString()
  @IsNotEmpty()
  studentId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  score?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  feedback?: string;
}

@Controller('supervisor')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('SUPERVISOR')
export class SupervisorController {
  constructor(private supervisorService: SupervisorService) {}

  @Get('dashboard')
  getDashboard(@Req() req: any) {
    return this.supervisorService.getDashboard(req.user.userId);
  }

  @Get('students')
  getStudents(@Req() req: any) {
    return this.supervisorService.getStudents(req.user.userId);
  }

  @Get('attendance')
  getAttendance(@Req() req: any, @Query() query: AttendanceQueryDto) {
    return this.supervisorService.getAttendance(req.user.userId, query.status);
  }

  @Patch('attendance/:id/approve')
  approveAttendance(@Req() req: any, @Param('id') id: string) {
    return this.supervisorService.approveAttendance(req.user.userId, id);
  }

  @Patch('attendance/:id/decline')
  declineAttendance(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: DeclineAttendanceDto,
  ) {
    return this.supervisorService.declineAttendance(
      req.user.userId,
      id,
      dto.reason,
    );
  }

  @Post('evaluations')
  createEvaluation(@Req() req: any, @Body() dto: CreateEvaluationDto) {
    return this.supervisorService.createEvaluation(req.user.userId, dto);
  }
}
