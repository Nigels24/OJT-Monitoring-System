import { Module } from '@nestjs/common';
import { SupervisorService } from './supervisor.service';
import { SupervisorController } from './supervisor.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EvaluationTemplateModule } from '../evaluation-template/evaluation-template.module';

@Module({
  imports: [PrismaModule, EvaluationTemplateModule],
  controllers: [SupervisorController],
  providers: [SupervisorService],
})
export class SupervisorModule {}
