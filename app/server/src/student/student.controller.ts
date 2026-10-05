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
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { StudentService, MAX_DOCUMENT_SIZE_BYTES } from './student.service';
import { DocumentType, PunchKind } from '../../generated/prisma/client';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { AuthedRequest } from '../auth/authed-request';
import { EmptyToNull } from '../common/transforms';

// A live punch carries only which punch it is. No date and no time: the
// server stamps both (Manila today, the current instant), and because nothing
// else is declared, forbidNonWhitelisted turns a client-sent `time` or `date`
// into a 400 rather than letting it through unread.
class PunchDto {
  @IsEnum(PunchKind)
  kind!: PunchKind;
}

class UpdateRemarksDto {
  // EmptyToNull: clearing the box erases the remark. Absent leaves it alone.
  @IsOptional()
  @EmptyToNull()
  @IsString()
  @MaxLength(500)
  remarks?: string | null;
}

// Students may only ever touch these two fields on their own record — every
// other field (name, course, requiredHours, status, ...) is coordinator-owned.
// Declaring nothing else here is what makes forbidNonWhitelisted reject an
// attempt to slip one in.
class UpdateProfileDto {
  // EmptyToNull so a student can actually erase a value they no longer want on
  // file. Absent from the body still means "leave unchanged".
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
}

// Multipart body: only the text field goes through the DTO. The file itself
// comes through @UploadedFile() and is validated in the service, not here —
// forbidNonWhitelisted has no notion of a multipart file part. See CLAUDE.md
// §7 "File storage — the decided design".
class UploadDocumentDto {
  @IsEnum(DocumentType)
  type!: DocumentType;
}

/**
 * Multer decodes the filename in a multipart header as latin1 unless told
 * otherwise, which turns "Résumé.pdf" into "RÃ©sumÃ©.pdf". Browsers send it as
 * UTF-8, and it is now stored (`Document.originalFileName`), so decode it as
 * UTF-8.
 */
const DOCUMENT_UPLOAD_OPTIONS = {
  limits: { fileSize: MAX_DOCUMENT_SIZE_BYTES },
  defParamCharset: 'utf8',
};

@Controller('student')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('STUDENT')
export class StudentController {
  constructor(private studentService: StudentService) {}

  @Get('dashboard')
  getDashboard(@Req() req: AuthedRequest) {
    return this.studentService.getDashboard(req.user.userId);
  }

  @Get('attendance/today')
  getTodayAttendance(@Req() req: AuthedRequest) {
    return this.studentService.getToday(req.user.userId);
  }

  @Post('attendance/punch')
  punch(@Req() req: AuthedRequest, @Body() dto: PunchDto) {
    return this.studentService.punch(req.user.userId, dto.kind);
  }

  @Patch('attendance/today/remarks')
  updateTodayRemarks(@Req() req: AuthedRequest, @Body() dto: UpdateRemarksDto) {
    return this.studentService.updateTodayRemarks(req.user.userId, dto.remarks);
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

  // Creates, or replaces the file already submitted for that type.
  @Post('documents')
  @UseInterceptors(FileInterceptor('file', DOCUMENT_UPLOAD_OPTIONS))
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
}
