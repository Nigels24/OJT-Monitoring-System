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
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { CoordinatorService } from './coordinator.service';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { EmptyToNull } from '../common/transforms';
import { attachmentDisposition } from '../common/document-types';
import { COURSE_LABELS } from '../common/courses';

// No `username` or `password` on the student create DTO: both are generated
// by the service (common/credentials.ts) and returned once in the create
// response. Sending either is a 400 under forbidNonWhitelisted. Supervisors are
// created inside an establishment (POST /establishments, POST
// /establishments/:id/supervisor), not here.

/**
 * Editing a supervisor: name parts, email and position. No `establishmentId`
 * and no `username` — sending either is a 400. The name is stored only as
 * User.name, so the service requires firstName and lastName together whenever
 * any part is sent, and rebuilds the whole name from them.
 *
 * firstName/lastName/email are NOT NULL, so a blank one is a 400 (no
 * transform); middleInitial and position are nullable, so a blank one clears.
 */
class UpdateSupervisorDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  firstName?: string;

  @IsOptional()
  @EmptyToNull()
  @IsString()
  @MaxLength(10)
  middleInitial?: string | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @EmptyToNull()
  @IsString()
  @MaxLength(120)
  position?: string | null;
}

/**
 * Personal and OJT fields the coordinator's student form collects. Shared by
 * create and update; create adds the identity fields below.
 *
 * Deliberately absent, so `forbidNonWhitelisted` turns any of them into a 400:
 * - `yearLevel` and `requiredHours` — derived from `course` by the service
 *   (`common/courses.ts`), never typed;
 * - `age`, `dateOfBirth`, `gender` and `endDate` — retired. Their columns stay
 *   in the schema, unused, and `PrismaService` omits them from every read.
 */
class StudentDetailsDto {
  // The nullable columns below use EmptyToNull, not EmptyToUndefined: on an
  // edit, emptying a box has to persist as cleared rather than silently keep
  // the old value. Absent from the body still means "leave unchanged".
  // `status`, on UpdateStudentDto, stays undefined-only — it is NOT NULL, so
  // null there is a write error, not a clear.
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

  // Clearing the establishment select unassigns the student — Student
  // .establishmentId is nullable for exactly that (see §8 item 17).
  @IsOptional()
  @EmptyToNull()
  @IsString()
  @IsNotEmpty()
  establishmentId?: string | null;

  // The day the student's OJT begins. Read by the coordinator's attendance
  // oversight (GET /coordinator/attendance), which measures approved days
  // against the calendar days elapsed since this date — a student with no
  // startDate reports a null percentage rather than a misleading 0%.
  @IsOptional()
  @EmptyToNull()
  @IsDateString()
  startDate?: string | null;
}

// No `status`: a new student is always ACTIVE (the service sets it), so a
// create body carrying one is a 400 under forbidNonWhitelisted. COMPLETED and
// INACTIVE are set later, by an edit.
class CreateStudentDto extends StudentDetailsDto {
  // Required, and must be one the school offers: it decides the student's
  // year level and required hours (common/courses.ts).
  @IsIn(COURSE_LABELS, {
    message: `course must be one of: ${COURSE_LABELS.join('; ')}`,
  })
  course!: string;

  @IsEmail()
  email!: string;

  // firstName and lastName (from StudentDetailsDto) are required on create —
  // the username is built from them — but they are optional in the shared
  // DTO for the edit form, so CoordinatorService.createStudent enforces it.
  // (Redeclaring them here would not work: class-validator inherits the
  // parent's @IsOptional.)

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  studentIdNumber!: string;
}

class UpdateStudentDto extends StudentDetailsDto {
  // Only a string check: a student saved before the offered list existed may
  // keep their old course, which CoordinatorService.updateStudent allows only
  // while it is unchanged — any new value must be on the list, and changing it
  // recomputes the year level and required hours.
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

@Controller('coordinator')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('COORDINATOR')
export class CoordinatorController {
  private readonly logger = new Logger(CoordinatorController.name);

  constructor(private coordinatorService: CoordinatorService) {}

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

  // "Resend login": a new generated password, shown once, and a forced change
  // at next sign-in. Replaces the old PATCH …/password, where the coordinator
  // typed the new password themselves. No body — the id in the path names the
  // account; there is nothing the caller gets to choose.
  @Post('students/:id/resend-credentials')
  resendStudentCredentials(@Param('id') id: string) {
    return this.coordinatorService.resendStudentCredentials(id);
  }

  @Post('supervisors/:id/resend-credentials')
  resendSupervisorCredentials(@Param('id') id: string) {
    return this.coordinatorService.resendSupervisorCredentials(id);
  }

  @Patch('supervisors/:id')
  updateSupervisor(@Param('id') id: string, @Body() dto: UpdateSupervisorDto) {
    return this.coordinatorService.updateSupervisor(id, dto);
  }

  @Delete('supervisors/:id')
  removeSupervisor(@Param('id') id: string) {
    return this.coordinatorService.removeSupervisor(id);
  }
}
