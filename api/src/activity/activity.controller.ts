import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ActivityService } from './activity.service';
import { CreateActivityEventDto } from './dto/create-activity-event.dto';
import { QueryActivityDto } from './dto/query-activity.dto';

@Controller('activity')
@UseGuards(AuthGuard)
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  getStream(
    @CurrentUser() user: { id: string },
    @Query() query: QueryActivityDto,
  ) {
    return this.activityService.getStream(query);
  }

  @Post()
  async ingestEvent(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateActivityEventDto,
  ) {
    if (!dto.userId) {
      dto.userId = user.id;
    }
    return this.activityService.ingestEvent(dto);
  }
}
