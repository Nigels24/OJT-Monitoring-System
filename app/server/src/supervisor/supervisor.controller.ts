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
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNotEmptyObject,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SupervisorService } from './supervisor.service';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { AuthedRequest } from '../auth/authed-request';
import { EmptyToNull, EmptyToUndefined } from '../common/transforms';
import { COURSE_LABELS } from '../common/courses';

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

/**
 * A student created by their establishment's supervisor. Same rules as the
 * coordinator's old create (F1/F3), with one more absence:
 *
 * - no `establishmentId` — the student's establishment is ALWAYS the caller's,
 *   derived from their supervisor row, never from the body;
 * - no `username` / `password` — generated, returned once;
 * - no `yearLevel` / `requiredHours` — derived from `course`;
 * - no `status` — a new student is ACTIVE;
 * - no `school` — the constant `SCHOOL_NAME`.
 *
 * Any of them in the body is a 400 under `forbidNonWhitelisted`.
 */
class CreateStudentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  studentIdNumber!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  firstName!: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @MaxLength(10)
  middleInitial?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  lastName!: string;

  @IsEmail()
  email!: string;

  // The offered courses only (ACT, BSIT); it decides year level and hours.
  @IsIn(COURSE_LABELS, {
    message: `course must be one of: ${COURSE_LABELS.join('; ')}`,
  })
  course!: string;

  // Philippine mobile format, as on the coordinator's edit form.
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

  @IsOptional()
  @EmptyToUndefined()
  @IsDateString()
  startDate?: string;
}

class SetStudentStatusDto {
  @IsIn(['ACTIVE', 'COMPLETED'])
  status!: 'ACTIVE' | 'COMPLETED';
}

class DeclineAttendanceDto {
  // Required: a declined punch with no explanation gives the student nothing to
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

  /**
   * Creates a student at the caller's own establishment, with a generated
   * login returned once in `credentials`.
   */
  @Post('students')
  createStudent(@Req() req: AuthedRequest, @Body() dto: CreateStudentDto) {
    return this.supervisorService.createStudent(req.user.userId, dto);
  }

  /** New temporary password for one of the caller's own students. */
  @Post('students/:id/resend-credentials')
  resendStudentCredentials(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.supervisorService.resendStudentCredentials(req.user.userId, id);
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

  @Patch('punches/:id/approve')
  approvePunch(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.supervisorService.approvePunch(req.user.userId, id);
  }

  @Patch('punches/:id/decline')
  declinePunch(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: DeclineAttendanceDto,
  ) {
    return this.supervisorService.declinePunch(req.user.userId, id, dto.reason);
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
