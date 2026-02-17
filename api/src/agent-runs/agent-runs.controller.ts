import { Body, Controller, Headers, Post, Param, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AgentRunsService } from './agent-runs.service';
import { CreateAgentRunDto } from './dto/create-agent-run.dto';
import { CreateAgentEventDto } from './dto/create-agent-event.dto';
import { CreateToolCallDto } from './dto/create-tool-call.dto';
import { CompleteAgentRunDto } from './dto/complete-agent-run.dto';

@Controller('agent-runs')
@UseGuards(AuthGuard)
export class AgentRunsController {
  constructor(
    private readonly agentRunsService: AgentRunsService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  async createRun(
    @CurrentUser() user: { id: string },
    @Body() payload: CreateAgentRunDto,
    @Headers('authorization') authorization?: string,
  ) {
    const { run, userContext, question } = await this.agentRunsService.createRun(user.id, payload);

    const agentBaseUrl = this.configService.get<string>('AGENT_BASE_URL') || 'http://localhost:8000';
    const agentRunPayload = {
      runId: run.id,
      conversationId: payload.conversationId,
      userId: user.id,
      userContext,
      question,
      runConfig: payload.config ?? {},
      symbols: payload.symbols ?? [],
    };

    await fetch(`${agentBaseUrl}/agent/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization || '',
      },
      body: JSON.stringify(agentRunPayload),
    });

    return { runId: run.id };
  }

  @Post(':runId/events')
  async createEvent(
    @CurrentUser() user: { id: string },
    @Param('runId') runId: string,
    @Body() payload: CreateAgentEventDto,
  ) {
    return this.agentRunsService.addEvent(user.id, runId, payload);
  }

  @Post(':runId/tool-calls')
  async createToolCall(
    @CurrentUser() user: { id: string },
    @Param('runId') runId: string,
    @Body() payload: CreateToolCallDto,
  ) {
    return this.agentRunsService.addToolCall(user.id, runId, payload);
  }

  @Post(':runId/complete')
  async completeRun(
    @CurrentUser() user: { id: string },
    @Param('runId') runId: string,
    @Body() payload: CompleteAgentRunDto,
  ) {
    return this.agentRunsService.completeRun(user.id, runId, payload);
  }
}
