import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Meeting, MeetingStatus } from './entities/meeting.entity';
import { MeetingInsight } from './entities/meeting-insight.entity';
import { EventsGateway } from '../gateway/events.gateway';
import { ActivityService } from '../activity/activity.service';
import { CreateMeetingInsightDto } from './dto/create-meeting-insight.dto';

@Injectable()
export class MeetingsService {
  private agentBaseUrl: string;

  constructor(
    @InjectRepository(Meeting)
    private readonly meetingRepo: Repository<Meeting>,
    @InjectRepository(MeetingInsight)
    private readonly insightRepo: Repository<MeetingInsight>,
    private readonly eventsGateway: EventsGateway,
    private readonly activityService: ActivityService,
    private readonly configService: ConfigService,
  ) {
    this.agentBaseUrl =
      this.configService.get('AGENT_BASE_URL') || 'http://localhost:8000';
  }

  async create(
    projectId: string,
    userId: string,
    title: string,
    rawTranscript: string,
    meetingDate?: string,
    source?: string,
    durationMinutes?: number,
  ): Promise<Meeting> {
    const meeting = this.meetingRepo.create({
      projectId,
      createdById: userId,
      title,
      rawTranscript,
      meetingDate: meetingDate ? new Date(meetingDate) : null,
      source: source || 'upload',
      durationMinutes,
      status: MeetingStatus.PENDING,
    });
    const saved = await this.meetingRepo.save(meeting);

    // Create activity event
    await this.activityService.ingestEvent({
      projectId,
      userId,
      source: 'meeting',
      eventType: 'meeting_uploaded',
      title: `Meeting transcript: ${title}`,
      summary: `Meeting transcript "${title}" uploaded for processing`,
    });

    // Trigger async processing via agent
    this.triggerProcessing(saved).catch((err) => {
      console.error(`[MeetingsService] Failed to trigger processing for ${saved.id}:`, err);
      this.markFailed(saved.id, err).catch(() => undefined);
    });

    return saved;
  }

  async findAllByProject(projectId: string): Promise<Meeting[]> {
    return this.meetingRepo.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
      relations: ['insights'],
    });
  }

  async findOne(id: string): Promise<Meeting> {
    const meeting = await this.meetingRepo.findOne({
      where: { id },
      relations: ['insights'],
    });
    if (!meeting) throw new NotFoundException('Meeting not found');
    return meeting;
  }

  async remove(id: string): Promise<void> {
    const meeting = await this.findOne(id);
    await this.insightRepo.delete({ meetingId: id });
    await this.meetingRepo.remove(meeting);
  }

  async updateStatus(
    id: string,
    status: MeetingStatus,
    processingError?: string,
    insightCount?: number,
  ): Promise<Meeting> {
    const meeting = await this.findOne(id);
    meeting.status = status;
    if (processingError !== undefined) meeting.processingError = processingError;
    if (insightCount !== undefined) meeting.insightCount = insightCount;
    const saved = await this.meetingRepo.save(meeting);

    this.eventsGateway.emitToProject(meeting.projectId, 'meeting:status', {
      meetingId: id,
      status,
      insightCount,
    });

    return saved;
  }

  async bulkCreateInsights(
    meetingId: string,
    insights: CreateMeetingInsightDto[],
  ): Promise<number> {
    const meeting = await this.findOne(meetingId);

    const entities = insights.map((dto) =>
      this.insightRepo.create({
        meetingId,
        insightType: dto.insightType,
        content: dto.content,
        assignee: dto.assignee,
        priority: dto.priority,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        metadata: dto.metadata,
      }),
    );
    await this.insightRepo.save(entities);

    // Create activity events for action items and blockers
    for (const insight of entities) {
      if (['action_item', 'blocker', 'decision'].includes(insight.insightType)) {
        await this.activityService.ingestEvent({
          projectId: meeting.projectId,
          userId: meeting.createdById,
          source: 'meeting',
          eventType: `meeting_${insight.insightType}`,
          title: `${insight.insightType.replace(/_/g, ' ')}: ${insight.content.slice(0, 80)}`,
          summary: insight.content,
          payload: { meetingId, insightId: insight.id, assignee: insight.assignee },
        });
      }
    }

    return entities.length;
  }

  async updateInsight(
    meetingId: string,
    insightId: string,
    updates: Partial<Pick<MeetingInsight, 'status' | 'linearIssueId'>>,
  ): Promise<MeetingInsight> {
    const insight = await this.insightRepo.findOne({
      where: { id: insightId, meetingId },
    });
    if (!insight) throw new NotFoundException('Insight not found');
    Object.assign(insight, updates);
    return this.insightRepo.save(insight);
  }

  async getInsights(meetingId: string): Promise<MeetingInsight[]> {
    await this.findOne(meetingId);
    return this.insightRepo.find({
      where: { meetingId },
      order: { createdAt: 'ASC' },
    });
  }

  async reprocess(id: string): Promise<Meeting> {
    const meeting = await this.findOne(id);
    await this.insightRepo.delete({ meetingId: id });
    meeting.status = MeetingStatus.PENDING;
    meeting.processingError = null;
    meeting.insightCount = 0;
    const saved = await this.meetingRepo.save(meeting);

    this.triggerProcessing(saved).catch((err) => {
      console.error(`[MeetingsService] Failed to trigger reprocessing for ${id}:`, err);
      this.markFailed(saved.id, err).catch(() => undefined);
    });

    return saved;
  }

  private async triggerProcessing(meeting: Meeting): Promise<void> {
    const url = `${this.agentBaseUrl}/agent/process-meeting`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meetingId: meeting.id,
        projectId: meeting.projectId,
        title: meeting.title,
        rawTranscript: meeting.rawTranscript,
        meetingDate: meeting.meetingDate?.toISOString(),
        source: meeting.source,
      }),
    });
    if (!response.ok) {
      throw new Error(`Agent returned ${response.status}`);
    }
  }

  private async markFailed(meetingId: string, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : 'Unknown processing error';
    try {
      await this.updateStatus(meetingId, MeetingStatus.FAILED, message);
    } catch {
      // no-op: best effort
    }
  }
}
