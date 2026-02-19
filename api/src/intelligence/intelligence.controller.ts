import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { IntelligenceService } from './intelligence.service';
import {
  BulkCreateRisksDto,
  UpdateRiskStatusDto,
  CreateWeeklySummaryDto,
} from './dto/create-risk-assessment.dto';

@Controller()
@UseGuards(AuthGuard)
export class IntelligenceController {
  constructor(private readonly intelligenceService: IntelligenceService) {}

  // ─── Risks ────────────────────────────────────────────────────

  @Get('projects/:projectId/intelligence/risks')
  async getRisks(
    @Param('projectId') projectId: string,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
  ) {
    return this.intelligenceService.getRisks(projectId, { status, severity });
  }

  @Post('projects/:projectId/intelligence/risks')
  async bulkCreateRisks(
    @Param('projectId') projectId: string,
    @Body() dto: BulkCreateRisksDto,
  ) {
    return this.intelligenceService.bulkCreateRisks(projectId, dto);
  }

  @Patch('intelligence/risks/:id')
  async updateRiskStatus(
    @Param('id') id: string,
    @Body() dto: UpdateRiskStatusDto,
  ) {
    return this.intelligenceService.updateRiskStatus(id, dto);
  }

  // ─── Summaries ────────────────────────────────────────────────

  @Get('projects/:projectId/intelligence/summaries')
  async getSummaries(@Param('projectId') projectId: string) {
    return this.intelligenceService.getSummaries(projectId);
  }

  @Post('projects/:projectId/intelligence/summaries')
  async createSummary(
    @Param('projectId') projectId: string,
    @Body() dto: CreateWeeklySummaryDto,
  ) {
    return this.intelligenceService.createSummary(projectId, dto);
  }

  // ─── Triggers ─────────────────────────────────────────────────

  @Post('projects/:projectId/intelligence/detect-risks')
  async triggerRiskDetection(@Param('projectId') projectId: string) {
    return this.intelligenceService.triggerRiskDetection(projectId);
  }

  @Post('projects/:projectId/intelligence/generate-summary')
  async triggerSummaryGeneration(@Param('projectId') projectId: string) {
    return this.intelligenceService.triggerSummaryGeneration(projectId);
  }

  // ─── Dashboard ────────────────────────────────────────────────

  @Get('projects/:projectId/intelligence/dashboard')
  async getDashboard(@Param('projectId') projectId: string) {
    return this.intelligenceService.getDashboard(projectId);
  }
}
