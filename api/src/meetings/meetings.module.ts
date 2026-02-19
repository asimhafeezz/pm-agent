import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Meeting } from './entities/meeting.entity';
import { MeetingInsight } from './entities/meeting-insight.entity';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { GatewayModule } from '../gateway/gateway.module';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Meeting, MeetingInsight]),
    GatewayModule,
    ActivityModule,
  ],
  controllers: [MeetingsController],
  providers: [MeetingsService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
