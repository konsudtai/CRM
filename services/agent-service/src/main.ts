import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || [],
    credentials: true,
  });

  const port = parseInt(process.env.PORT || '3006', 10);
  await app.listen(port);
  console.log(`Agent service running on port ${port}`);
  console.log(`  Bedrock region: ${process.env.BEDROCK_REGION || 'ap-southeast-1'}`);
  console.log(`  Model: ${process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-haiku-20241022-v1:0'}`);
}

bootstrap();
