import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { SchedulerService } from '../scheduler.service';
import { ActivityService } from '../../activity/activity.service';

interface SchedulerJobData {
  jobId: string;
  projectId: string;
  userId: string;
  jobType: string;
  config: Record<string, unknown>;
}

@Processor('scheduler')
export class SchedulerProcessor extends WorkerHost {
  private readonly logger = new Logger(SchedulerProcessor.name);
  private readonly agentBaseUrl: string;

  constructor(
    private readonly schedulerService: SchedulerService,
    private readonly activityService: ActivityService,
    private readonly configService: ConfigService,
  ) {
    super();
    this.agentBaseUrl = this.configService.get('AGENT_BASE_URL') || 'http://localhost:8000';
  }

  async process(job: Job<SchedulerJobData>): Promise<void> {
    const { jobId, projectId, userId, jobType, config } = job.data;
    this.logger.log(`Processing scheduled job ${jobId}: ${jobType}`);

    try {
      switch (jobType) {
        case 'standup':
          await this.processStandup(projectId, userId, config);
          break;
        case 'sprint_digest':
          await this.processSprintDigest(projectId, userId, config);
          break;
        case 'blocker_check':
          await this.processBlockerCheck(projectId, userId, config);
          break;
        case 'risk_detection':
          await this.processRiskDetection(projectId, userId, config);
          break;
        case 'weekly_summary':
          await this.processWeeklySummary(projectId, userId, config);
          break;
        default:
          this.logger.warn(`Unknown job type: ${jobType}`);
      }

      await this.schedulerService.updateLastRun(jobId, 'success');
    } catch (error) {
      this.logger.error(`Scheduled job ${jobId} failed: ${error}`);
      await this.schedulerService.updateLastRun(jobId, 'failed');
      throw error;
    }
  }

  private async processStandup(
    projectId: string,
    userId: string,
    config: Record<string, unknown>,
  ): Promise<void> {
    // Trigger agent to send standup prompts and process responses
    const url = `${this.agentBaseUrl}/agent/trigger-standup`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, userId, config }),
    });

    if (!response.ok) {
      throw new Error(`Agent standup trigger returned ${response.status}`);
    }

    await this.activityService.ingestEvent({
      projectId,
      userId,
      source: 'agent',
      eventType: 'standup_triggered',
      title: 'Daily standup triggered',
      summary: 'Standup prompts sent to team members',
    });
  }

  private async processSprintDigest(
    projectId: string,
    userId: string,
    config: Record<string, unknown>,
  ): Promise<void> {
    const url = `${this.agentBaseUrl}/agent/generate-sprint-digest`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, userId, config }),
    });

    if (!response.ok) {
      throw new Error(`Agent sprint digest returned ${response.status}`);
    }

    await this.activityService.ingestEvent({
      projectId,
      userId,
      source: 'agent',
      eventType: 'sprint_digest_generated',
      title: 'Sprint digest generated',
      summary: 'Sprint health digest has been generated and sent',
    });
  }

  private async processBlockerCheck(
    projectId: string,
    userId: string,
    config: Record<string, unknown>,
  ): Promise<void> {
    const url = `${this.agentBaseUrl}/agent/check-blockers`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, userId, config }),
    });

    if (!response.ok) {
      throw new Error(`Agent blocker check returned ${response.status}`);
    }

    await this.activityService.ingestEvent({
      projectId,
      userId,
      source: 'agent',
      eventType: 'blocker_check_completed',
      title: 'Blocker check completed',
      summary: 'Automated blocker check has been performed',
    });
  }

  private async processRiskDetection(
    projectId: string,
    userId: string,
    config: Record<string, unknown>,
  ): Promise<void> {
    const url = `${this.agentBaseUrl}/agent/detect-risks`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, userId, config }),
    });

    if (!response.ok) {
      throw new Error(`Agent risk detection returned ${response.status}`);
    }

    await this.activityService.ingestEvent({
      projectId,
      userId,
      source: 'agent',
      eventType: 'risk_detection_completed',
      title: 'Risk detection completed',
      summary: 'Automated risk detection scan has been performed',
    });
  }

  private async processWeeklySummary(
    projectId: string,
    userId: string,
    config: Record<string, unknown>,
  ): Promise<void> {
    const url = `${this.agentBaseUrl}/agent/generate-summary`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, userId, config }),
    });

    if (!response.ok) {
      throw new Error(`Agent weekly summary returned ${response.status}`);
    }

    await this.activityService.ingestEvent({
      projectId,
      userId,
      source: 'agent',
      eventType: 'weekly_summary_generated',
      title: 'Weekly summary generated',
      summary: 'Automated weekly project summary has been generated',
    });
  }
}
