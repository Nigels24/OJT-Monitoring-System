import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  EvaluationTemplateService,
  MAX_ITEMS_PER_SECTION,
  MAX_SECTIONS,
} from './evaluation-template.service';
import { Roles, RolesGuard } from '../auth/roles.guard';

/**
 * One row of the sheet.
 *
 * `key` identifies an item that already exists on the draft — send it to keep
 * the item (and any association a score has with it) while changing its
 * wording. Omit it to add a new item; the server mints the key.
 */
class DraftItemDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  key?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  label!: string;
}

class DraftSectionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  key?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  label!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ITEMS_PER_SECTION)
  @ValidateNested({ each: true })
  @Type(() => DraftItemDto)
  items!: DraftItemDto[];
}

/**
 * The whole draft, every time — the same "whole sheet, not a partial"
 * convention as `PATCH /supervisor/evaluations/:id`. Array order is printed
 * order; numerals and letters are derived from it on read.
 */
class ReplaceDraftDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SECTIONS)
  @ValidateNested({ each: true })
  @Type(() => DraftSectionDto)
  sections!: DraftSectionDto[];
}

/**
 * The coordinator's evaluation sheet editor.
 *
 * Role-prefixed under `/coordinator` like every other coordinator-scoped
 * resource, but its own module: the sheet is not a coordinator-only concept —
 * `SupervisorService` reads the published version through the same service.
 */
@Controller('coordinator/evaluation-template')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('COORDINATOR')
export class EvaluationTemplateController {
  constructor(private templateService: EvaluationTemplateService) {}

  @Get()
  getTemplate() {
    return this.templateService.getOverview();
  }

  @Put('draft')
  replaceDraft(@Body() dto: ReplaceDraftDto) {
    return this.templateService.replaceDraft(dto);
  }

  @Post('publish')
  publishDraft() {
    return this.templateService.publishDraft();
  }

  @Delete('draft')
  discardDraft() {
    return this.templateService.discardDraft();
  }
}
