import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // whitelist strips properties the DTO does not declare, so a request can
  // never smuggle extra columns into a Prisma `data` spread (several services
  // spread the DTO directly). transform runs the class-transformer decorators
  // on the DTOs, which is what turns query/body strings into numbers.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableShutdownHooks();

  app.enableCors({
    origin: 'http://localhost:3001',
    credentials: true,
    // Content-Disposition is not a CORS-safelisted response header, so without
    // this the evaluation PDF download can read the bytes but not the filename
    // the server chose, and falls back to rebuilding it client-side.
    exposedHeaders: ['Content-Disposition'],
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
