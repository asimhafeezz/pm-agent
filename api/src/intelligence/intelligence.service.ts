import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { RiskAssessment, RiskStatus, RiskSeverity, RiskType } from './entities/risk-assessment.entity';
import { WeeklySummary } from './entities/weekly-summary.entity';
import {
  CreateRiskAssessmentDto,
  BulkCreateRisksDto,
  UpdateRiskStatusDto,
  CreateWeeklySummaryDto,
} from './dto/create-risk-assessment.dto';
import { ActivityService } from '../activity/activity.service';

@Injectable()
export class IntelligenceService {
  private readonly logger = new Logger(IntelligenceService.name);
  private readonly agentBaseUrl: string;

  constructor(
    @InjectRepository(RiskAssessment)
    private readonly riskRepo: Repository<RiskAssessment>,
    @InjectRepository(WeeklySummary)
    private readonly summaryRepo: Repository<WeeklySummary>,
    private readonly activityService: ActivityService,
    private readonly configService: ConfigService,
  ) {
    this.agentBaseUrl =
      this.configService.get('AGENT_BASE_URL') || 'http://localhost:8000';
  }

  // ─── Risks ────────────────────────────────────────────────────

  async createRisk(
    projectId: string,
    dto: CreateRiskAssessmentDto,
  ): Promise<RiskAssessment> {
    const risk = this.riskRepo.create({
      projectId,
      riskType: dto.riskType as RiskType,
      severity: dto.severity as RiskSeverity,
      description: dto.description,
      mitigation: dto.mitigation || null,
      evidence: dto.evidence || null,
      linkedIssueId: dto.linkedIssueId || null,
      status: RiskStatus.OPEN,
      detectedAt: new Date(),
    });
    const saved = await this.riskRepo.save(risk);

    await this.activityService.ingestEvent({
      projectId,
      source: 'agent',
      eventType: 'risk_detected',
      title: `Risk detected: ${dto.riskType}`,
      summary: dto.description.slice(0, 200),
      payload: { riskId: saved.id, severity: dto.severity, riskType: dto.riskType },
    });

    return saved;
  }

  async bulkCreateRisks(
    projectId: string,
    dto: BulkCreateRisksDto,
  ): Promise<RiskAssessment[]> {
    const results: RiskAssessment[] = [];
    for (const risk of dto.risks) {
      results.push(await this.createRisk(projectId, risk));
    }
    return results;
  }

  async getRisks(
    projectId: string,
    options?: { status?: string; severity?: string },
  ): Promise<RiskAssessment[]> {
    const where: Record<string, unknown> = { projectId };
    if (options?.status) where.status = options.status;
    if (options?.severity) where.severity = options.severity;

    return this.riskRepo.find({
      where,
      order: { detectedAt: 'DESC' },
    });
  }

  async getRisk(id: string): Promise<RiskAssessment> {
    const risk = await this.riskRepo.findOne({ where: { id } });
    if (!risk) throw new NotFoundException('Risk assessment not found');
    return risk;
  }

  async updateRiskStatus(
    id: string,
    dto: UpdateRiskStatusDto,
  ): Promise<RiskAssessment> {
    const risk = await this.getRisk(id);
    risk.status = dto.status as RiskStatus;
    if (dto.status === 'resolved' || dto.status === 'mitigated') {
      risk.resolvedAt = new Date();
    }
    return this.riskRepo.save(risk);
  }

  // ─── Summaries ────────────────────────────────────────────────

  async createSummary(
    projectId: string,
    dto: CreateWeeklySummaryDto,
  ): Promise<WeeklySummary> {
    const summary = this.summaryRepo.create({
      projectId,
      executiveSummary: dto.executiveSummary,
      metrics: dto.metrics || null,
      highlights: dto.highlights || null,
      risks: dto.risks || null,
      recommendations: dto.recommendations || null,
      periodStart: new Date(dto.periodStart),
      periodEnd: new Date(dto.periodEnd),
    });
    const saved = await this.summaryRepo.save(summary);

    await this.activityService.ingestEvent({
      projectId,
      source: 'agent',
      eventType: 'weekly_summary_generated',
      title: 'Weekly summary generated',
      summary: dto.executiveSummary.slice(0, 200),
    });

    return saved;
  }

  async getSummaries(projectId: string, limit = 10): Promise<WeeklySummary[]> {
    return this.summaryRepo.find({
      where: { projectId },
      order: { periodEnd: 'DESC' },
      take: limit,
    });
  }

  async getLatestSummary(projectId: string): Promise<WeeklySummary | null> {
    return this.summaryRepo.findOne({
      where: { projectId },
      order: { periodEnd: 'DESC' },
    });
  }

  // ─── Agent Triggers ───────────────────────────────────────────

  async triggerRiskDetection(projectId: string): Promise<Record<string, unknown>> {
    try {
      const url = `${this.agentBaseUrl}/agent/detect-risks`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) throw new Error(`Agent returned ${res.status}`);
      return res.json();
    } catch (error) {
      this.logger.error(`Risk detection trigger failed: ${error}`);
      throw error;
    }
  }

  async triggerSummaryGeneration(projectId: string): Promise<Record<string, unknown>> {
    try {
      const url = `${this.agentBaseUrl}/agent/generate-summary`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) throw new Error(`Agent returned ${res.status}`);
      return res.json();
    } catch (error) {
      this.logger.error(`Summary generation trigger failed: ${error}`);
      throw error;
    }
  }

  // ─── Dashboard ────────────────────────────────────────────────

  async getDashboard(projectId: string) {
    const [openRisks, latestSummary] = await Promise.all([
      this.getRisks(projectId, { status: 'open' }),
      this.getLatestSummary(projectId),
    ]);

    const criticalCount = openRisks.filter((r) => r.severity === RiskSeverity.CRITICAL).length;
    const highCount = openRisks.filter((r) => r.severity === RiskSeverity.HIGH).length;

    return {
      risks: {
        total: openRisks.length,
        critical: criticalCount,
        high: highCount,
        items: openRisks,
      },
      latestSummary,
    };
  }
}
