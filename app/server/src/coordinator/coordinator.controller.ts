import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Res,
  Query,
  Logger,
} from '@nestjs/common';
import archiver from 'archiver';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CoordinatorService } from './coordinator.service';
import { Roles, RolesGuard } from '../auth/roles.guard';
import {
  EmptyToNull,
  EmptyToUndefined,
  ToNullableNumber,
  ToOptionalNumber,
} from '../common/transforms';
import { attachmentDisposition } from '../common/document-types';
import { COURSES } from '../common/courses';

// Usernames must not contain "@" so they can never shadow an email address
// when AuthService.login matches an identifier against both columns.
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{4,30}$/;
const USERNAME_MESSAGE =
  'username must be 4-30 characters using letters, numbers, dot, underscore or hyphen (no "@")';

class CreateSupervisorDto {
  @IsEmail()
  email!: string;

  @Matches(USERNAME_PATTERN, { message: USERNAME_MESSAGE })
  username!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  establishmentId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  position?: string;
}

/**
 * Personal and OJT fields the coordinator's student form collects. Shared by
 * create and update; create adds the identity fields below.
 */
class StudentDetailsDto {
  // The nullable columns below use EmptyToNull, not EmptyToUndefined: on an
  // edit, emptying a box has to persist as cleared rather than silently keep
  // the old value. Absent from the body still means "leave unchanged".
  // `requiredHours` (and `status`, on UpdateStudentDto) stay on the
  // undefined-based transforms — they are NOT NULL, so null there is a write
  // error, not a clear.
  @IsOptional()
  @EmptyToNull()
  @IsString()
  @MaxLength(120)
  firstName?: string | null;

  @IsOptional()
  @EmptyToNull()
  @IsString()
  @MaxLength(120)
  lastName?: string | null;

  @IsOptional()
  @EmptyToNull()
  @IsString()
  @MaxLength(10)
  middleInitial?: string | null;

  @IsOptional()
  @ToNullableNumber()
  @IsInt()
  @Min(15)
  @Max(100)
  age?: number | null;

  @IsOptional()
  @EmptyToNull()
  @IsDateString()
  dateOfBirth?: string | null;

  @IsOptional()
  @EmptyToNull()
  @IsString()
  @MaxLength(200)
  school?: string | null;

  // Philippine mobile format, matching the prototype's own input validation.
  @IsOptional()
  @EmptyToNull()
  @Matches(/^\d{11}$/, {
    message: 'contactNumber must be exactly 11 digits (e.g. 09123456789)',
  })
  contactNumber?: string | null;

  @IsOptional()
  @EmptyToNull()
  @IsString()
  @MaxLength(255)
  address?: string | null;

  // `course` is declared on CreateStudentDto and UpdateStudentDto, not here:
  // the two validate it differently.

  @IsOptional()
  @EmptyToNull()
  @IsString()
  @MaxLength(30)
  yearLevel?: string | null;

  // Clearing the establishment select unassigns the student — Student
  // .establishmentId is nullable for exactly that (see §8 item 17).
  @IsOptional()
  @EmptyToNull()
  @IsString()
  @IsNotEmpty()
  establishmentId?: string | null;

  @IsOptional()
  @ToOptionalNumber()
  @IsInt()
  @Min(0)
  requiredHours?: number;

  // The day the student's OJT begins. Read by the coordinator's attendance
  // oversight (GET /coordinator/attendance), which measures approved days
  // against the calendar days elapsed since this date — a student with no
  // startDate reports a null percentage rather than a misleading 0%.
  @IsOptional()
  @EmptyToNull()
  @IsDateString()
  startDate?: string | null;

  // The EXPECTED end of the OJT — a planning date the coordinator enters, not
  // the day it actually finished. It bounds nothing: completion is decided by
  // hours (see attendanceBlockedReason in StudentService), so a student who hasn't met
  // requiredHours by this date keeps logging past it.
  @IsOptional()
  @EmptyToNull()
  @IsDateString()
  endDate?: string | null;

  // Same option list as the coordinator's establishment form. Null on both
  // sides for the students that predate the field.
  @IsOptional()
  @EmptyToNull()
  @IsIn(['Male', 'Female', 'Other'])
  gender?: string | null;
}

// No `status`: a new student is always ACTIVE (the service sets it), so a
// create body carrying one is a 400 under forbidNonWhitelisted. COMPLETED and
// INACTIVE are set later, by an edit.
class CreateStudentDto extends StudentDetailsDto {
  // A new student's course must be one the school offers. Blank is allowed.
  @IsOptional()
  @EmptyToNull()
  @IsIn(COURSES, { message: `course must be one of: ${COURSES.join('; ')}` })
  course?: string | null;

  @IsEmail()
  email!: string;

  // The coordinator issues both credentials by hand and passes them to the
  // student. This replaced an earlier server-generated temporary password.
  @Matches(USERNAME_PATTERN, { message: USERNAME_MESSAGE })
  username!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  // Only needed when first/last name are not supplied; the service composes
  // User.name from the name parts when it can.
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  studentIdNumber!: string;
}

class UpdateStudentDto extends StudentDetailsDto {
  // Only a string check: a student saved before the offered list existed may
  // keep their old course, which CoordinatorService.updateStudent allows only
  // while it is unchanged — any new value must be on the list.
  @IsOptional()
  @EmptyToNull()
  @IsString()
  @MaxLength(120)
  course?: string | null;

  @IsOptional()
  @IsIn(['ACTIVE', 'PENDING', 'COMPLETED', 'INACTIVE'])
  status?: 'ACTIVE' | 'PENDING' | 'COMPLETED' | 'INACTIVE';
}

class BulkDeleteStudentsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  ids!: string[];
}

class ResetPasswordDto {
  @IsString()
  @MinLength(8)
  password!: string;
}

@Controller('coordinator')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('COORDINATOR')
export class CoordinatorController {
  private readonly logger = new Logger(CoordinatorController.name);

  constructor(private coordinatorService: CoordinatorService) {}

  @Post('supervisors')
  createSupervisor(@Body() dto: CreateSupervisorDto) {
    return this.coordinatorService.createSupervisor(dto);
  }

  @Post('students')
  createStudent(@Body() dto: CreateStudentDto) {
    return this.coordinatorService.createStudent(dto);
  }

  @Get('students')
  listStudents() {
    return this.coordinatorService.listStudents();
  }

  @Get('supervisors')
  listSupervisors() {
    return this.coordinatorService.listSupervisors();
  }

  @Get('dashboard')
  getDashboard() {
    return this.coordinatorService.getDashboard();
  }

  @Get('attendance')
  getAttendanceOversight() {
    return this.coordinatorService.getAttendanceOversight();
  }

  @Get('evaluations')
  listEvaluations() {
    return this.coordinatorService.listEvaluations();
  }

  /**
   * The filled-in sheet as a PDF, for the coordinator to forward to the
   * student. `@Res()` because this answers with bytes and two headers rather
   * than JSON — the whole document is built first and sent in one write, so a
   * failure is a clean error rather than a truncated 200 (see
   * `common/evaluation-pdf.ts`).
   */
  @Get('evaluations/:id/pdf')
  async downloadEvaluationPdf(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { filename, body } =
      await this.coordinatorService.getEvaluationPdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    // The filename is ASCII and separator-free by construction, so the plain
    // quoted form is enough — no RFC 5987 encoding needed.
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', body.length);
    res.end(body);
  }

  @Get('documents')
  getDocuments() {
    return this.coordinatorService.getDocuments();
  }

  /**
   * One document as an attachment. The client fetches it with the bearer
   * token and either saves it or opens it as an object URL to view — a plain
   * link can't carry the Authorization header. `@Res()` for the same reason
   * as the evaluation PDF above: bytes and headers, not JSON.
   */
  @Get('documents/:id/download')
  async downloadDocument(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { filename, buffer, contentType } =
      await this.coordinatorService.getDocumentFile(id);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', attachmentDisposition(filename));
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }

  /**
   * A ZIP of one student's documents: `?ids=a,b,c` for a selection, no `ids`
   * for all of them. The files are fetched first (see the service), so by the
   * time a header is written the only thing left to fail is the zipping
   * itself, in memory.
   */
  @Get('students/:studentId/documents/zip')
  async downloadStudentDocumentsZip(
    @Param('studentId') studentId: string,
    @Query('ids') ids: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const requested = [
      ...new Set(
        (ids ?? '')
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    ];
    const { filename, entries } =
      await this.coordinatorService.getStudentDocumentsZip(
        studentId,
        requested,
      );

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', attachmentDisposition(filename));

    // PDFs and JPEG/PNG are already compressed; deflating them again costs
    // CPU and saves next to nothing, so entries are stored as-is.
    const archive = archiver('zip', { store: true });
    archive.on('error', (err) => {
      this.logger.error(`ZIP for student ${studentId} failed: ${err.message}`);
      res.destroy(err);
    });
    archive.pipe(res);
    for (const entry of entries) {
      archive.append(entry.buffer, { name: entry.name });
    }
    await archive.finalize();
  }

  @Patch('students/:id')
  updateStudent(@Param('id') id: string, @Body() dto: UpdateStudentDto) {
    return this.coordinatorService.updateStudent(id, dto);
  }

  @Delete('students/:id')
  removeStudent(@Param('id') id: string) {
    return this.coordinatorService.removeStudent(id);
  }

  /**
   * Deletes students who finished their OJT, in one request. All-or-nothing
   * on validation (every id must exist and be COMPLETED, else 400 and nothing
   * is deleted); each student then goes in its own transaction.
   */
  @Post('students/bulk-delete')
  bulkRemoveStudents(@Body() dto: BulkDeleteStudentsDto) {
    return this.coordinatorService.bulkRemoveStudents(dto.ids);
  }

  // Recovery for a forgotten password. No current password required — see
  // CoordinatorService.resetStudentPassword.
  @Patch('students/:id/password')
  resetStudentPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) {
    return this.coordinatorService.resetStudentPassword(id, dto.password);
  }

  @Patch('supervisors/:id/password')
  resetSupervisorPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.coordinatorService.resetSupervisorPassword(id, dto.password);
  }

  @Delete('supervisors/:id')
  removeSupervisor(@Param('id') id: string) {
    return this.coordinatorService.removeSupervisor(id);
  }
}
