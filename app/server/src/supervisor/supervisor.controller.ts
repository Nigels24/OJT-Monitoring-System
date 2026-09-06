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
import { AuthedRequest } from '../auth/authed-request';
import { EmptyToNull, EmptyToUndefined } from '../common/transforms';
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
 * The official sheet's 1-5 bound, applied to every item so the scale is
 * declared once rather than repeated nineteen times.
 */
const Item = () =>
  applyDecorators(
    Type(() => Number),
    IsInt(),
    Min(MIN_SCORE),
    Max(MAX_SCORE),
  );

/**
 * The nineteen scored items plus the sheet's editable header fields.
 *
 * `totalRating` and the `evaluatorName`/`evaluatorPosition`/`trainingEmployedAt`
 * snapshots are absent on purpose: the server derives all four
 * (src/common/evaluation-scoring.ts and SupervisorService), and
 * `forbidNonWhitelisted` rejects a body that tries to supply them.
 *
 * Item order matches the paper form. Section maximums are 25 / 20 / 25 / 25.
 */
class EvaluationSheetDto {
  // I. WORK ATTITUDES AND HABITS (25 points)
  @Item() courtesy!: number;
  @Item() patienceAndDiligence!: number;
  @Item() punctualityAndAttendance!: number;
  @Item() neatnessOfReports!: number;
  @Item() punctualityOfReports!: number;

  // II. WORK KNOWLEDGE (20 points)
  @Item() technicalKnowledge!: number;
  @Item() relatesTheoryToPractice!: number;
  @Item() openToCriticism!: number;
  @Item() discretion!: number;

  // III. PERSONALITY AND PERSONAL APPEARANCE (25 points)
  @Item() neatAndWellGroomed!: number;
  @Item() properAttire!: number;
  @Item() poiseAndSelfConfidence!: number;
  @Item() emotionalMaturity!: number;
  @Item() dealsWellWithCoworkers!: number;

  // IV. PROFESSIONAL COMPETENCE (25 points)
  @Item() performanceOfWork!: number;
  @Item() understandsInstructions!: number;
  @Item() sharesSuggestions!: number;
  @Item() ethicalStandards!: number;
  @Item() speaksAudibly!: number;

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
  getEvaluationSheet() {
    return this.supervisorService.getEvaluationSheet();
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
