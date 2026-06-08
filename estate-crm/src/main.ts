import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { config } from './config/app.config';
import cookieParser from 'cookie-parser';
import { EstateCrmProblemDetailFilter } from './common/filters/problem-details.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { TenantGuard } from './common/guards/tenant.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { Reflector } from '@nestjs/core';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: ['https://crm-web.localhost:1355'],
    credentials: true,
  });

  app.use(cookieParser());
  app.setGlobalPrefix('api');

  // Global validation pipe — class-validator + class-transformer
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

  // Global exception filter — RFC 7807/9457 Problem Details
  app.useGlobalFilters(new EstateCrmProblemDetailFilter());

  // Global guards — order matters: JwtAuth → Tenant → Roles
  const reflector = app.get(Reflector);
  app.useGlobalGuards(
    new JwtAuthGuard(reflector),
    new TenantGuard(reflector),
    new RolesGuard(reflector),
  );

  // Swagger / OpenAPI docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Estate CRM API')
    .setDescription('Multi-tenant CRM for real estate brokerage organizations')
    .setVersion('1.0')
    .addCookieAuth('access_token', {
      type: 'apiKey',
      in: 'cookie',
      name: 'access_token',
    })
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  // Write Swagger JSON spec to project root using Bun's native API
  await Bun.write('swagger.json', JSON.stringify(document, null, 2));
  console.log('Swagger spec saved to: swagger.json');

  const port = config.PORT;
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap();
