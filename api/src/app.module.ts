import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ConversationsModule } from './conversations/conversations.module';
import { AgentRunsModule } from './agent-runs/agent-runs.module';
import { UsersModule } from './users/users.module';
import { User } from './users/entities/user.entity';
import { Conversation } from './conversations/entities/conversation.entity';
import { Message } from './conversations/entities/message.entity';
import { AgentRun } from './agent-runs/entities/agent-run.entity';
import { ToolCall } from './agent-runs/entities/tool-call.entity';
import { AgentRunEvent } from './agent-runs/entities/agent-run-event.entity';

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
        entities: [User, Conversation, Message, AgentRun, ToolCall, AgentRunEvent],
        synchronize: true, // As requested by user
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule, // Added UsersModule
    ConversationsModule,
    AgentRunsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
