import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  // Enable rawBody for webhook signature verification (Slack requires raw body)
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  // Enable CORS for Observer dashboard
  app.enableCors({
    origin: ['http://localhost:3001', 'http://127.0.0.1:3001'],
    credentials: true,
  });

  // Enable global validation for DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip unknown properties
      forbidNonWhitelisted: true, // Throw on unknown properties
      transform: true, // Auto-transform payloads to DTO instances
    }),
  );

  // Configure Swagger/OpenAPI
  const config = new DocumentBuilder()
    .setTitle('Oblivion Nexus API')
    .setDescription(
      'REST API for Oblivion - Kubernetes-native orchestration for AI agents. ' +
        'This API enables agents to authenticate, claim tasks, update status, ' +
        'and interact with Slack threads.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token obtained from POST /auth/token',
      },
      'JWT',
    )
    .addTag('Authentication', 'OAuth2 Client Credentials flow for agent authentication')
    .addTag('Tasks', 'Task management - list, claim, and update task status')
    .addTag('Slack', 'Slack thread operations - read and post messages')
    .addTag('Groups', 'Group management for multi-tenant organization')
    .addTag('Projects', 'Project management with @tag routing')
    .addTag('Agents', 'Agent registration and management')
    .addTag('Observer', 'Dashboard endpoints for monitoring')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`Nexus running on http://localhost:${port}`);
  console.log(`Swagger API docs at http://localhost:${port}/api`);
}
bootstrap();
