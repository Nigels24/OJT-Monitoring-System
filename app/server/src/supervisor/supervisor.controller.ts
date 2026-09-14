import {
  Controller,
  Delete,
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
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNotEmptyObject,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SupervisorService } from './supervisor.service';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { AuthedRequest } from '../auth/authed-request';
import { EmptyToNull, EmptyToUndefined } from '../common/transforms';

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
 * One filled-in sheet: the scores plus the editable header fields.
 *
 * `scores` is a single nested object keyed by the template's own item keys —
 * not the nineteen top-level fields it used to be. The sheet is data now, so a
 * DTO cannot list the keys, and `forbidNonWhitelisted` would reject the dynamic
 * ones. It is checked here only for being a non-empty object; the real
 * validation is `EvaluationTemplateService.validateScores`, which requires
 * every item of *that evaluation's* template version, each an integer 1-5, and
 * rejects any key the template does not have.
 *
 * `totalRating`, `maxTotalRating` and the
 * `evaluatorName`/`evaluatorPosition`/`trainingEmployedAt` snapshots are absent
 * on purpose: the server derives all of them, and `forbidNonWhitelisted`
 * rejects a body that tries to supply them.
 */
class EvaluationSheetDto {
  @IsObject()
  @IsNotEmptyObject()
  scores!: Record<string, number>;

  @IsOptional()
  @EmptyToUndefined()
  @IsDateString()
  trainingStartedAt?: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsDateString()
  trainingEndedAt?: string;

  // EmptyToNull, not EmptyToUndefined: clearing the box on an edit has to
  // persist as cleared. Absent from the body still means "leave unchanged".
  @IsOptional()
  @EmptyToNull()
  @IsString()
  @MaxLength(2000)
  comments?: string | null;

  @IsOptional()
  @EmptyToNull()
  @IsString()
  @MaxLength(2000)
  recommendations?: string | null;
}

class CreateEvaluationDto extends EvaluationSheetDto {
  @IsString()
  @IsNotEmpty()
  studentId!: string;
}

/**
 * Edit takes the whole sheet again, not a partial: every item is required on
 * the paper form, so a PATCH that left some out would have to invent scores to
 * recompute the total. `studentId` is deliberately absent — an edit cannot move
 * an evaluation to a different student.
 */
class UpdateEvaluationDto extends EvaluationSheetDto {}

@Controller('supervisor')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('SUPERVISOR')
export class SupervisorController {
  constructor(private supervisorService: SupervisorService) {}

  @Get('dashboard')
  getDashboard(@Req() req: AuthedRequest) {
    return this.supervisorService.getDashboard(req.user.userId);
  }

  @Get('students')
  getStudents(@Req() req: AuthedRequest) {
    return this.supervisorService.getStudents(req.user.userId);
  }

  @Get('attendance')
  getAttendance(@Req() req: AuthedRequest, @Query() query: AttendanceQueryDto) {
    return this.supervisorService.getAttendance(
      req.user.userId,
      query.status,
      query.includeCompleted,
    );
  }

  @Patch('students/:id/status')
  setStudentStatus(
    @Req() req: AuthedRequest,
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
  approveAttendance(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.supervisorService.approveAttendance(req.user.userId, id);
  }

  @Patch('attendance/:id/decline')
  declineAttendance(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: DeclineAttendanceDto,
  ) {
    return this.supervisorService.declineAttendance(
      req.user.userId,
      id,
      dto.reason,
    );
  }

  /**
   * The blank sheet's structure. Declared before `evaluations` only for
   * readability — Nest matches the literal path, not declaration order, and
   * there is no `evaluations/:id` GET to shadow it.
   */
  @Get('evaluations/form')
  getEvaluationSheet(@Req() req: AuthedRequest) {
    return this.supervisorService.getEvaluationSheet(req.user.userId);
  }

  @Get('evaluations')
  getEvaluations(@Req() req: AuthedRequest) {
    return this.supervisorService.getEvaluations(req.user.userId);
  }

  @Post('evaluations')
  createEvaluation(
    @Req() req: AuthedRequest,
    @Body() dto: CreateEvaluationDto,
  ) {
    return this.supervisorService.createEvaluation(req.user.userId, dto);
  }

  @Patch('evaluations/:id')
  updateEvaluation(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateEvaluationDto,
  ) {
    return this.supervisorService.updateEvaluation(req.user.userId, id, dto);
  }

  @Delete('evaluations/:id')
  removeEvaluation(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.supervisorService.removeEvaluation(req.user.userId, id);
  }
}
