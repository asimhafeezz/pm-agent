import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StandupsService } from './standups.service';
import { CreateStandupResponseDto } from './dto/create-standup-response.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller()
export class StandupsController {
  constructor(private readonly standupsService: StandupsService) {}

  // Internal endpoint — called by integration-service webhooks (no auth guard)
  @Post('standups/responses')
  createResponse(@Body() dto: CreateStandupResponseDto) {
    return this.standupsService.createResponse(dto);
  }

  @Get('projects/:projectId/standups/responses')
  @UseGuards(AuthGuard)
  getResponses(
    @Param('projectId') projectId: string,
    @Query('since') since?: string,
    @Query('limit') limit?: string,
  ) {
    return this.standupsService.getResponses(projectId, {
      since,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('projects/:projectId/standups/today')
  @UseGuards(AuthGuard)
  getTodayResponses(@Param('projectId') projectId: string) {
    return this.standupsService.getTodayResponses(projectId);
  }

  @Get('projects/:projectId/standups/summary')
  @UseGuards(AuthGuard)
  generateSummary(@Param('projectId') projectId: string) {
    return this.standupsService.generateSummary(projectId);
  }
}
