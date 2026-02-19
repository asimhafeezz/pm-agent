import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ConversationsModule } from './conversations/conversations.module';
import { AgentRunsModule } from './agent-runs/agent-runs.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { ProjectsModule } from './projects/projects.module';
import { FilesModule } from './files/files.module';
import { GatewayModule } from './gateway/gateway.module';
import { DocumentsModule } from './documents/documents.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { ActivityModule } from './activity/activity.module';
import { MeetingsModule } from './meetings/meetings.module';
import { BullModule } from '@nestjs/bullmq';
import { SchedulerModule } from './scheduler/scheduler.module';
import { StandupsModule } from './standups/standups.module';
import { IntelligenceModule } from './intelligence/intelligence.module';
import { User } from './users/entities/user.entity';
import { Conversation } from './conversations/entities/conversation.entity';
import { Message } from './conversations/entities/message.entity';
import { AgentRun } from './agent-runs/entities/agent-run.entity';
import { ToolCall } from './agent-runs/entities/tool-call.entity';
import { AgentRunEvent } from './agent-runs/entities/agent-run-event.entity';
import { Organization } from './organizations/entities/organization.entity';
import { OrganizationMember } from './organizations/entities/organization-member.entity';
import { Project } from './projects/entities/project.entity';
import { Document } from './documents/entities/document.entity';
import { DocumentChunk } from './documents/entities/document-chunk.entity';
import { KnowledgeEntity } from './knowledge/entities/knowledge-entity.entity';
import { KnowledgeRelation } from './knowledge/entities/knowledge-relation.entity';
import { IntegrationConnection } from './integrations/entities/integration-connection.entity';
import { ActivityEvent } from './activity/entities/activity-event.entity';
import { Meeting } from './meetings/entities/meeting.entity';
import { MeetingInsight } from './meetings/entities/meeting-insight.entity';
import { ScheduledJob } from './scheduler/entities/scheduled-job.entity';
import { StandupResponse } from './standups/entities/standup-response.entity';
import { RiskAssessment } from './intelligence/entities/risk-assessment.entity';
import { WeeklySummary } from './intelligence/entities/weekly-summary.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get('DATABASE_URL'),
        entities: [
          User,
          Conversation,
          Message,
          AgentRun,
          ToolCall,
          AgentRunEvent,
          Organization,
          OrganizationMember,
          Project,
          Document,
          DocumentChunk,
          KnowledgeEntity,
          KnowledgeRelation,
          IntegrationConnection,
          ActivityEvent,
          Meeting,
          MeetingInsight,
          ScheduledJob,
          StandupResponse,
          RiskAssessment,
          WeeklySummary,
        ],
        synchronize: true,
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    ConversationsModule,
    AgentRunsModule,
    OrganizationsModule,
    ProjectsModule,
    FilesModule,
    GatewayModule,
    DocumentsModule,
    KnowledgeModule,
    IntegrationsModule,
    ActivityModule,
    MeetingsModule,
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
    SchedulerModule,
    StandupsModule,
    IntelligenceModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
