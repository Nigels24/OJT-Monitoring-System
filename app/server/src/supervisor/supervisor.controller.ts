import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SupervisorService } from './supervisor.service';
import { Roles, RolesGuard } from '../auth/roles.guard';

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

  @Get('attendance')
  getPendingAttendance(@Req() req: any) {
    return this.supervisorService.getPendingAttendance(req.user.userId);
  }

  @Patch('attendance/:id/approve')
  approveAttendance(@Req() req: any, @Param('id') id: string) {
    return this.supervisorService.approveAttendance(req.user.userId, id);
  }

  @Patch('attendance/:id/decline')
  declineAttendance(@Req() req: any, @Param('id') id: string) {
    return this.supervisorService.declineAttendance(req.user.userId, id);
  }

  @Post('evaluations')
  createEvaluation(@Req() req: any, @Body() dto: CreateEvaluationDto) {
    return this.supervisorService.createEvaluation(req.user.userId, dto);
  }
}
