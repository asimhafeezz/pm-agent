import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingStatusDto } from './dto/update-meeting-status.dto';
import { BulkCreateInsightsDto } from './dto/create-meeting-insight.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller()
@UseGuards(AuthGuard)
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Post('projects/:projectId/meetings')
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateMeetingDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.meetingsService.create(
      projectId,
      user.id,
      dto.title,
      dto.rawTranscript,
      dto.meetingDate,
      dto.source,
      dto.durationMinutes,
    );
  }

  @Get('projects/:projectId/meetings')
  findAll(@Param('projectId') projectId: string) {
    return this.meetingsService.findAllByProject(projectId);
  }

  @Get('meetings/:id')
  findOne(@Param('id') id: string) {
    return this.meetingsService.findOne(id);
  }

  @Delete('meetings/:id')
  remove(@Param('id') id: string) {
    return this.meetingsService.remove(id);
  }

  @Post('meetings/:id/reprocess')
  reprocess(@Param('id') id: string) {
    return this.meetingsService.reprocess(id);
  }

  @Patch('meetings/:id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateMeetingStatusDto,
  ) {
    return this.meetingsService.updateStatus(
      id,
      dto.status,
      dto.processingError,
      dto.insightCount,
    );
  }

  @Get('meetings/:id/insights')
  getInsights(@Param('id') id: string) {
    return this.meetingsService.getInsights(id);
  }

  @Post('meetings/:id/insights')
  bulkCreateInsights(
    @Param('id') id: string,
    @Body() dto: BulkCreateInsightsDto,
  ) {
    return this.meetingsService.bulkCreateInsights(id, dto.insights);
  }

  @Patch('meetings/:id/insights/:insightId')
  updateInsight(
    @Param('id') meetingId: string,
    @Param('insightId') insightId: string,
    @Body() updates: { status?: string; linearIssueId?: string },
  ) {
    return this.meetingsService.updateInsight(meetingId, insightId, updates as any);
  }
}
