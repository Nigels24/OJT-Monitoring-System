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
  applyDecorators,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
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
import { MAX_SCORE, MIN_SCORE } from '../common/evaluation-scoring';

class AttendanceQueryDto {
  @IsOptional()
  @EmptyToUndefined()
  @IsIn(['PENDING', 'APPROVED', 'DECLINED'])
  status?: 'PENDING' | 'APPROVED' | 'DECLINED';

  /** Include finished batches, which are hidden from the queue by default. */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeCompleted?: boolean;
}

class SetStudentStatusDto {
  @IsIn(['ACTIVE', 'COMPLETED'])
  status!: 'ACTIVE' | 'COMPLETED';
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

/**
 * Applies the shared 1–5 bound to every criterion, so the rubric is defined in
 * one place rather than repeated nine times.
 */
const Criterion = () =>
  applyDecorators(
    Type(() => Number),
    IsInt(),
    Min(MIN_SCORE),
    Max(MAX_SCORE),
  );

class CreateEvaluationDto {
  @IsString()
  @IsNotEmpty()
  studentId!: string;

  // The nine criteria. Weights and the overall rating are computed server-side
  // (src/common/evaluation-scoring.ts) — the client cannot supply either.
  @Criterion() quality!: number;
  @Criterion() quantity!: number;
  @Criterion() efficiency!: number;
  @Criterion() attendance!: number;
  @Criterion() teamwork!: number;
  @Criterion() communication!: number;
  @Criterion() knowledge!: number;
  @Criterion() problemSolving!: number;
  @Criterion() initiative!: number;

  @IsOptional()
  @EmptyToUndefined()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsDateString()
  periodEnd?: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @MaxLength(2000)
  comments?: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @MaxLength(2000)
  recommendations?: string;
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
    return this.supervisorService.getAttendance(
      req.user.userId,
      query.status,
      query.includeCompleted,
    );
  }

  @Patch('students/:id/status')
  setStudentStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: SetStudentStatusDto,
  ) {
    return this.supervisorService.setStudentStatus(
      req.user.userId,
      id,
      dto.status,
    );
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

  @Get('evaluations')
  getEvaluations(@Req() req: any) {
    return this.supervisorService.getEvaluations(req.user.userId);
  }

  @Post('evaluations')
  createEvaluation(@Req() req: any, @Body() dto: CreateEvaluationDto) {
    return this.supervisorService.createEvaluation(req.user.userId, dto);
  }
}
