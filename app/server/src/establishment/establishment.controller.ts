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
import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { EstablishmentService } from './establishment.service';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { EmptyToUndefined } from '../common/transforms';

/**
 * A supervisor created inside an establishment — nested in POST
 * /establishments, or the whole body of POST /establishments/:id/supervisor.
 *
 * No `username` or `password`: both are generated (common/credentials.ts) and
 * returned once. The name comes in parts because the username is built from
 * the first initial and the last name ("Juan Dela Cruz" -> jdelacruz).
 * No `establishmentId` either: the establishment is the one being created, or
 * the one in the path.
 */
class NewSupervisorDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  firstName!: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @MaxLength(10)
  middleInitial?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @MaxLength(120)
  position?: string;
}

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

  // The establishment's supervisor, created with it in one transaction. The
  // old "Establishment Coordinator" contact fields (coordinatorFirstName …
  // coordinatorEmail) described this same person; they are gone from the DTO,
  // so sending one is a 400. Their columns stay in the schema, unused.
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => NewSupervisorDto)
  supervisor?: NewSupervisorDto;
}

// Same fields as create, all optional, minus `supervisor`. PartialType
// rewrites the validation metadata rather than inheriting it, which plain
// `extends` cannot do without making `name` optional on create too.
//
// `supervisor` is create-only: an existing establishment gains one through
// POST /establishments/:id/supervisor, and supervisors are edited on their own
// route (PATCH /coordinator/supervisors/:id). Sending it here is a 400.
//
// `status` lives only here: a new establishment is always ACTIVE (the service
// sets it), so a create body carrying one is a 400 under forbidNonWhitelisted.
// Deactivating is an edit.
class UpdateEstablishmentDto extends PartialType(
  OmitType(CreateEstablishmentDto, ['supervisor'] as const),
) {
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';
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

  /**
   * Adds a supervisor to an existing establishment — the same body as the
   * nested `supervisor` on create, and the same one-time `credentials` back.
   * A second supervisor is not refused yet; the client offers this only when
   * there is none.
   */
  @Post(':id/supervisor')
  @Roles('COORDINATOR')
  addSupervisor(@Param('id') id: string, @Body() dto: NewSupervisorDto) {
    return this.establishmentService.addSupervisor(id, dto);
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
