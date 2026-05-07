const serverlessExpress = require('@codegenie/serverless-express');
const express = require('express');

let cachedServer;

async function bootstrap() {
  if (cachedServer) return cachedServer;

  const { NestFactory } = require('@nestjs/core');
  const { ExpressAdapter } = require('@nestjs/platform-express');
  const { ValidationPipe } = require('@nestjs/common');
  const { AppModule } = require('./app.module');

  const expressApp = express();
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
    { logger: ['error', 'warn'] },
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['*'],
    credentials: true,
  });

  await app.init();
  cachedServer = serverlessExpress({ app: expressApp });
  return cachedServer;
}

exports.handler = async (event, context) => {
  const server = await bootstrap();
  return server(event, context);
};
