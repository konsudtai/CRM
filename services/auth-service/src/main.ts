import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ── Security Hardening ─────────────────────────────────────────────────
  // Helmet sets various HTTP headers for security (XSS, clickjacking, etc.)
  app.use(
    helmet({
      hsts: {
        maxAge: 31536000, // 1 year in seconds
        includeSubDomains: true,
        preload: true,
      },
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
  });

  // ── OpenAPI 3.0 Documentation ──────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Thai SMB CRM API')
    .setDescription(
      'RESTful API for the Thai SMB CRM platform. ' +
      'Supports JWT bearer tokens, OAuth 2.0, and API key authentication.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearer',
    )
    .addApiKey(
      { type: 'apiKey', name: 'X-API-Key', in: 'header' },
      'api-key',
    )
    .addTag('Auth', 'Authentication and session management')
    .addTag('Users', 'User management within a tenant')
    .addTag('Roles', 'Role and permission management')
    .addTag('API Keys', 'API key management for external integrations')
    .addTag('Accounts', 'Customer account management')
    .addTag('Contacts', 'Contact management')
    .addTag('Leads', 'Lead capture and management')
    .addTag('Opportunities', 'Sales opportunity and pipeline management')
    .addTag('Tasks', 'Task and activity management')
    .addTag('Quotations', 'Quotation creation and management')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = parseInt(process.env.PORT || '3001', 10);
  await app.listen(port);
  console.log(`Auth service running on port ${port}`);
  console.log(`OpenAPI docs available at http://localhost:${port}/api/docs`);
}

bootstrap();
