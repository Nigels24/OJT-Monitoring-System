import { Module } from '@nestjs/common';
import { EvaluationTemplateService } from './evaluation-template.service';
import { EvaluationTemplateController } from './evaluation-template.controller';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * The versioned evaluation sheet.
 *
 * The service is exported because SupervisorModule needs it: the supervisor's
 * blank form is the published template, and writing or editing an evaluation
 * validates its scores against a template version.
 */
@Module({
  imports: [PrismaModule],
  controllers: [EvaluationTemplateController],
  providers: [EvaluationTemplateService],
  exports: [EvaluationTemplateService],
})
export class EvaluationTemplateModule {}
