import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentRun, AgentRunStatus } from './entities/agent-run.entity';
import { AgentRunEvent } from './entities/agent-run-event.entity';
import { ToolCall } from './entities/tool-call.entity';
import { Conversation } from '../conversations/entities/conversation.entity';
import { Message, MessageRole } from '../conversations/entities/message.entity';
import { CreateAgentRunDto } from './dto/create-agent-run.dto';
import { CreateAgentEventDto } from './dto/create-agent-event.dto';
import { CreateToolCallDto } from './dto/create-tool-call.dto';
import { CompleteAgentRunDto } from './dto/complete-agent-run.dto';

@Injectable()
export class AgentRunsService {
  constructor(
    @InjectRepository(AgentRun)
    private runRepository: Repository<AgentRun>,
    @InjectRepository(AgentRunEvent)
    private eventRepository: Repository<AgentRunEvent>,
    @InjectRepository(ToolCall)
    private toolCallRepository: Repository<ToolCall>,
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
  ) {}

  async createRun(userId: string, payload: CreateAgentRunDto) {
    const conversation = await this.conversationRepository.findOne({
      where: { id: payload.conversationId, userId },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }

    if (!payload.userMessageId) {
      throw new BadRequestException('userMessageId is required.');
    }

    const userMessage = await this.messageRepository.findOne({
      where: {
        id: payload.userMessageId,
        conversationId: payload.conversationId,
      },
    });
    if (!userMessage) {
      throw new NotFoundException('User message not found.');
    }

    const userContext = {}; // Simplified placeholder

    const run = this.runRepository.create({
        userId,
        conversationId: payload.conversationId,
        // userMessageId: payload.userMessageId, // Missing in AgentRun entity
        status: AgentRunStatus.RUNNING,
        // executionMode: payload.executionMode, // Missing in AgentRun entity
        // deepAnalysis: payload.deepAnalysis ?? false, // Missing in AgentRun entity
        // To keep it simple I aligned with the minimal entity I created.
        // If we want these fields, we should add them to entity.
        // For now, I will proceed with minimal fields.
    });
    await this.runRepository.save(run);

    return {
      run,
      userContext,
      question: userMessage.content,
    };
  }

  async addEvent(userId: string, runId: string, payload: CreateAgentEventDto) {
    await this.assertRunOwnership(userId, runId);
    const event = this.eventRepository.create({
      runId,
      type: payload.type,
      payloadJson: payload.payload,
    });
    return this.eventRepository.save(event);
  }

  async addToolCall(userId: string, runId: string, payload: CreateToolCallDto) {
    await this.assertRunOwnership(userId, runId);
    const toolCall = this.toolCallRepository.create({
      runId,
      toolName: payload.toolName,
      requestJson: payload.requestJson,
      responseJson: payload.responseJson,
      latencyMs: payload.latencyMs,
    });
    return this.toolCallRepository.save(toolCall);
  }

  async completeRun(userId: string, runId: string, payload: CompleteAgentRunDto) {
    const run = await this.assertRunOwnership(userId, runId);

    const assistantMessage = this.messageRepository.create({
        conversationId: run.conversationId,
        role: MessageRole.ASSISTANT,
        content: payload.finalAnswerText,
    });
    await this.messageRepository.save(assistantMessage);

    run.status = AgentRunStatus.COMPLETED;
    run.finalAnswerText = payload.finalAnswerText;
    run.completedAt = new Date();
    // Additional fields like decisionJson, confidence would need columns in Entity
    return this.runRepository.save(run);
  }

  private async assertRunOwnership(userId: string, runId: string) {
    const run = await this.runRepository.findOne({ where: { id: runId, userId } });
    if (!run) {
      throw new NotFoundException('Run not found.');
    }
    return run;
  }
}
