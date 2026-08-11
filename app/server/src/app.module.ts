// Loaded here as well as in main.ts: anything that boots AppModule directly
// (the e2e tests) never runs main.ts, and JwtStrategy/AuthModule now read
// JWT_SECRET at module-init and throw when it is missing.
import 'dotenv/config';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { CoordinatorModule } from './coordinator/coordinator.module';
import { EstablishmentModule } from './establishment/establishment.module';
import { StudentModule } from './student/student.module';
import { SupervisorModule } from './supervisor/supervisor.module';

@Module({
  imports: [AuthModule, PrismaModule, CoordinatorModule, EstablishmentModule, StudentModule, SupervisorModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
