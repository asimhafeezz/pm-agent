import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { StandupResponse } from './entities/standup-response.entity';
import { CreateStandupResponseDto } from './dto/create-standup-response.dto';
import { ActivityService } from '../activity/activity.service';

@Injectable()
export class StandupsService {
  private readonly logger = new Logger(StandupsService.name);
  private agentBaseUrl: string;

  constructor(
    @InjectRepository(StandupResponse)
    private readonly responseRepo: Repository<StandupResponse>,
    private readonly activityService: ActivityService,
    private readonly configService: ConfigService,
  ) {
    this.agentBaseUrl =
      this.configService.get('AGENT_BASE_URL') || 'http://localhost:8000';
  }

  async createResponse(dto: CreateStandupResponseDto): Promise<StandupResponse> {
    const response = this.responseRepo.create({
      projectId: dto.projectId,
      respondent: dto.respondent,
      respondentUserId: dto.respondentUserId,
      rawText: dto.rawText,
      yesterday: dto.yesterday,
      today: dto.today,
      blockers: dto.blockers,
      respondedAt: new Date(),
      source: dto.source || 'ui',
      metadata: dto.metadata,
    });
    const saved = await this.responseRepo.save(response);

    await this.activityService.ingestEvent({
      projectId: dto.projectId,
      source: 'meeting',
      eventType: 'standup_response',
      title: `Standup from ${dto.respondent}`,
      summary: dto.rawText.slice(0, 200),
      payload: { respondent: dto.respondent, source: dto.source },
    });

    return saved;
  }

  async getResponses(
    projectId: string,
    options?: { since?: string; limit?: number },
  ): Promise<StandupResponse[]> {
    const where: Record<string, unknown> = { projectId };
    if (options?.since) {
      where.respondedAt = MoreThanOrEqual(new Date(options.since));
    }

    return this.responseRepo.find({
      where,
      order: { respondedAt: 'DESC' },
      take: options?.limit || 50,
    });
  }

  async getTodayResponses(projectId: string): Promise<StandupResponse[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.responseRepo.find({
      where: {
        projectId,
        respondedAt: MoreThanOrEqual(today),
      },
      order: { respondedAt: 'ASC' },
    });
  }

  async generateSummary(projectId: string): Promise<Record<string, unknown>> {
    const responses = await this.getTodayResponses(projectId);

    if (responses.length === 0) {
      return { summary: 'No standup responses collected today.', responses: [] };
    }

    // Trigger agent to generate summary
    try {
      const url = `${this.agentBaseUrl}/agent/process-standup`;
      const result = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          responses: responses.map((r) => ({
            respondent: r.respondent,
            rawText: r.rawText,
            yesterday: r.yesterday,
            today: r.today,
            blockers: r.blockers,
            respondedAt: r.respondedAt,
          })),
        }),
      });

      if (result.ok) {
        return result.json();
      }
    } catch (error) {
      this.logger.error(`Failed to generate standup summary: ${error}`);
    }

    return {
      summary: `${responses.length} standup responses collected. Agent processing unavailable.`,
      responses: responses.map((r) => ({
        respondent: r.respondent,
        rawText: r.rawText,
        respondedAt: r.respondedAt,
      })),
    };
  }
}
