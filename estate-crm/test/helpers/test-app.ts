import { Test, TestingModule } from '@nestjs/testing';
import { ModuleMetadata, INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { EstateCrmProblemDetailFilter } from '@/common/filters/problem-details.filter';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Reflector } from '@nestjs/core';

/**
 * Creates a compiled NestJS testing module from the given metadata.
 * Thin wrapper around Test.createTestingModule for consistency.
 */
export async function createTestingModule(
  metadata: ModuleMetadata,
): Promise<TestingModule> {
  return Test.createTestingModule(metadata).compile();
}

/**
 * Creates a NestJS application instance from a compiled module,
 * configured with middleware, global guards, exception filter, and validation.
 */
export async function createTestApp(
  module: TestingModule,
): Promise<INestApplication> {
  const app = module.createNestApplication<NestExpressApplication>();

  app.use(cookieParser());
  app.setGlobalPrefix('api');

  // Global validation pipe (same config as main.ts)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new EstateCrmProblemDetailFilter());

  // Global guards
  const reflector = app.get(Reflector);
  app.useGlobalGuards(
    new JwtAuthGuard(reflector),
    new TenantGuard(reflector),
    new RolesGuard(reflector),
  );

  await app.init();
  return app;
}
