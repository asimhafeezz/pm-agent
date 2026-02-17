import { Module } from '@nestjs/common';
import { AgentRunsController } from './agent-runs.controller';
import { AgentRunsService } from './agent-runs.service';


import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentRun } from './entities/agent-run.entity';
import { AgentRunEvent } from './entities/agent-run-event.entity';
import { ToolCall } from './entities/tool-call.entity';
import { Conversation } from '../conversations/entities/conversation.entity';
import { Message } from '../conversations/entities/message.entity';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AgentRun, AgentRunEvent, ToolCall, Conversation, Message]),
    MessagesModule,
  ],
  controllers: [AgentRunsController],
  providers: [AgentRunsService],
})
export class AgentRunsModule {}
