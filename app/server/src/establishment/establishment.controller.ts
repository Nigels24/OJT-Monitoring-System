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
import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { EstablishmentService } from './establishment.service';
import { Roles, RolesGuard } from '../auth/roles.guard';

class CreateEstablishmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  industryType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  streetAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  barangay?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  province?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  zipCode?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  coordinatorFirstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  coordinatorLastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  coordinatorMiddleInitial?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  coordinatorAge?: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  coordinatorGender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  coordinatorPosition?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  coordinatorAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  coordinatorContact?: string;

  @IsOptional()
  @IsEmail()
  coordinatorEmail?: string;
}

// Same fields as create, all optional. PartialType rewrites the validation
// metadata rather than inheriting it, which plain `extends` cannot do without
// making `name` optional on create too.
class UpdateEstablishmentDto extends PartialType(CreateEstablishmentDto) {}

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
