import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { CreateScheduledJobDto } from './dto/create-scheduled-job.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller()
@UseGuards(AuthGuard)
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  @Post('projects/:projectId/scheduler/jobs')
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateScheduledJobDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.schedulerService.create(projectId, user.id, dto);
  }

  @Get('projects/:projectId/scheduler/jobs')
  findAll(@Param('projectId') projectId: string) {
    return this.schedulerService.findAll(projectId);
  }

  @Get('scheduler/jobs/:id')
  findOne(@Param('id') id: string) {
    return this.schedulerService.findOne(id);
  }

  @Patch('scheduler/jobs/:id')
  update(
    @Param('id') id: string,
    @Body() updates: { cronExpression?: string; isActive?: boolean; config?: Record<string, unknown> },
  ) {
    return this.schedulerService.update(id, updates);
  }

  @Delete('scheduler/jobs/:id')
  remove(@Param('id') id: string) {
    return this.schedulerService.remove(id);
  }

  @Post('scheduler/jobs/:id/trigger')
  trigger(@Param('id') id: string) {
    return this.schedulerService.trigger(id);
  }
}
