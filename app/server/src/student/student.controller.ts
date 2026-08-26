import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  StudentService,
  MAX_DOCUMENT_SIZE_BYTES,
  CREDENTIAL_TYPES,
} from './student.service';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { AuthedRequest } from '../auth/authed-request';
import { EmptyToUndefined } from '../common/transforms';

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

// Students may only ever touch these two fields on their own record — every
// other field (name, course, requiredHours, status, ...) is coordinator-owned.
// Declaring nothing else here is what makes forbidNonWhitelisted reject an
// attempt to slip one in.
class UpdateProfileDto {
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
}

// Multipart body: only the text field goes through the DTO. The file itself
// comes through @UploadedFile() and is validated in the service, not here —
// forbidNonWhitelisted has no notion of a multipart file part. See CLAUDE.md
// §7 "File storage — the decided design".
class UploadDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;
}

// Same multipart shape as documents — see UploadDocumentDto above.
class UploadCredentialDto {
  @IsIn(CREDENTIAL_TYPES)
  type!: (typeof CREDENTIAL_TYPES)[number];
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

  @Get('profile')
  getProfile(@Req() req: AuthedRequest) {
    return this.studentService.getProfile(req.user.userId);
  }

  @Patch('profile')
  updateProfile(@Req() req: AuthedRequest, @Body() dto: UpdateProfileDto) {
    return this.studentService.updateProfile(req.user.userId, dto);
  }

  @Post('documents')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_DOCUMENT_SIZE_BYTES } }),
  )
  uploadDocument(
    @Req() req: AuthedRequest,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.studentService.uploadDocument(req.user.userId, dto, file);
  }

  @Get('documents')
  getMyDocuments(@Req() req: AuthedRequest) {
    return this.studentService.getMyDocuments(req.user.userId);
  }

  @Delete('documents/:id')
  deleteDocument(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.studentService.deleteDocument(req.user.userId, id);
  }

  @Post('credentials')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_DOCUMENT_SIZE_BYTES } }),
  )
  uploadCredential(
    @Req() req: AuthedRequest,
    @Body() dto: UploadCredentialDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.studentService.uploadCredential(req.user.userId, dto, file);
  }

  @Get('credentials')
  getMyCredentials(@Req() req: AuthedRequest) {
    return this.studentService.getMyCredentials(req.user.userId);
  }

  @Delete('credentials/:id')
  deleteCredential(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.studentService.deleteCredential(req.user.userId, id);
  }
}
