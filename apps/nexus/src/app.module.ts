import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { GatewayModule } from './gateway/gateway.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { GroupsModule } from './groups/groups.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [
    // Load .env file
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    IntegrationsModule, // ClickUp & Slack API clients
    AuthModule,
    GatewayModule,
    WebhooksModule,
    GroupsModule, // Agent Teams management
    ProjectsModule, // Work Scopes management
    TasksModule, // Task claiming and management
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
