import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CoordinatorService } from './coordinator.service';
import { Roles, RolesGuard } from '../auth/roles.guard';

class CreateSupervisorDto {
  email!: string;
  password!: string;
  name!: string;
  establishmentId!: string;
  position?: string;
}

class CreateStudentDto {
  email!: string;
  password!: string;
  name!: string;
  studentIdNumber!: string;
  course?: string;
  establishmentId?: string;
  requiredHours?: number;
}

class UpdateStudentDto {
  establishmentId?: string;
  course?: string;
  requiredHours?: number;
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

  @Patch('students/:id')
  updateStudent(@Param('id') id: string, @Body() dto: UpdateStudentDto) {
    return this.coordinatorService.updateStudent(id, dto);
  }
}
