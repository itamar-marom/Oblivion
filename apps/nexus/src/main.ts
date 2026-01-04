import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
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

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`Nexus running on http://localhost:${port}`);
}
bootstrap();
