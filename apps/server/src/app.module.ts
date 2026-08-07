import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { CoordinatorModule } from './coordinator/coordinator.module';

@Module({
  imports: [AuthModule, PrismaModule, CoordinatorModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
