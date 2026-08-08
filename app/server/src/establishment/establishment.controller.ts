import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { EstablishmentService } from './establishment.service';
import { Roles, RolesGuard } from '../auth/roles.guard';

class CreateEstablishmentDto {
  name!: string;
  industryType?: string;
  streetAddress?: string;
  region?: string;
  barangay?: string;
  city?: string;
  province?: string;
  zipCode?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  coordinatorFirstName?: string;
  coordinatorLastName?: string;
  coordinatorMiddleInitial?: string;
  coordinatorAge?: number;
  coordinatorGender?: string;
  coordinatorPosition?: string;
  coordinatorAddress?: string;
  coordinatorContact?: string;
  coordinatorEmail?: string;
}

class UpdateEstablishmentDto {
  name?: string;
  industryType?: string;
  streetAddress?: string;
  region?: string;
  barangay?: string;
  city?: string;
  province?: string;
  zipCode?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  coordinatorFirstName?: string;
  coordinatorLastName?: string;
  coordinatorMiddleInitial?: string;
  coordinatorAge?: number;
  coordinatorGender?: string;
  coordinatorPosition?: string;
  coordinatorAddress?: string;
  coordinatorContact?: string;
  coordinatorEmail?: string;
}

@Controller('establishments')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class EstablishmentController {
  constructor(private establishmentService: EstablishmentService) {}

  @Post()
  @Roles('COORDINATOR')
  create(@Body() dto: CreateEstablishmentDto) {
    return this.establishmentService.create(dto);
  }

  @Get()
  findAll() {
    return this.establishmentService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.establishmentService.findOne(id);
  }

  @Patch(':id')
  @Roles('COORDINATOR')
  update(@Param('id') id: string, @Body() dto: UpdateEstablishmentDto) {
    return this.establishmentService.update(id, dto);
  }

  @Delete(':id')
  @Roles('COORDINATOR')
  remove(@Param('id') id: string) {
    return this.establishmentService.remove(id);
  }
}
