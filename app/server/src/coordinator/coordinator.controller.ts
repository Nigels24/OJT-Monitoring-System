import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
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
  ValidateIf,
} from 'class-validator';
import { CoordinatorService } from './coordinator.service';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { AuthedRequest } from '../auth/authed-request';
import { EmptyToUndefined, ToOptionalNumber } from '../common/transforms';

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
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @MaxLength(120)
  firstName?: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @MaxLength(120)
  lastName?: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @MaxLength(10)
  middleInitial?: string;

  @IsOptional()
  @ToOptionalNumber()
  @IsInt()
  @Min(15)
  @Max(100)
  age?: number;

  @IsOptional()
  @EmptyToUndefined()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @MaxLength(200)
  school?: string;

  // Philippine mobile format, matching the prototype's own input validation.
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
  @IsString()
  @MaxLength(120)
  course?: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @MaxLength(30)
  yearLevel?: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @IsNotEmpty()
  establishmentId?: string;

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
  @EmptyToUndefined()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'PENDING', 'COMPLETED', 'INACTIVE'])
  status?: 'ACTIVE' | 'PENDING' | 'COMPLETED' | 'INACTIVE';
}

class CreateStudentDto extends StudentDetailsDto {
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

class UpdateStudentDto extends StudentDetailsDto {}

class ResetPasswordDto {
  @IsString()
  @MinLength(8)
  password!: string;
}

class ReviewDocumentDto {
  @IsIn(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';

  // Required only on rejection — same shape as Attendance's decline reason.
  // @ValidateIf skips every check below when the condition is false, so an
  // APPROVED body needs nothing here at all.
  @ValidateIf((o: ReviewDocumentDto) => o.status === 'REJECTED')
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(500)
  reviewNote?: string;
}

@Controller('coordinator')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('COORDINATOR')
export class CoordinatorController {
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

  @Get('documents')
  getDocuments() {
    return this.coordinatorService.getDocuments();
  }

  @Patch('documents/:id/review')
  reviewDocument(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: ReviewDocumentDto,
  ) {
    return this.coordinatorService.reviewDocument(
      req.user.userId,
      id,
      dto.status,
      dto.reviewNote,
    );
  }

  @Patch('students/:id')
  updateStudent(@Param('id') id: string, @Body() dto: UpdateStudentDto) {
    return this.coordinatorService.updateStudent(id, dto);
  }

  @Delete('students/:id')
  removeStudent(@Param('id') id: string) {
    return this.coordinatorService.removeStudent(id);
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
}
