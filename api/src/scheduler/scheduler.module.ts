import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ScheduledJob } from './entities/scheduled-job.entity';
import { SchedulerController } from './scheduler.controller';
import { SchedulerService } from './scheduler.service';
import { SchedulerProcessor } from './processors/scheduler.processor';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ScheduledJob]),
    BullModule.registerQueue({ name: 'scheduler' }),
    ActivityModule,
  ],
  controllers: [SchedulerController],
  providers: [SchedulerService, SchedulerProcessor],
  exports: [SchedulerService],
})
export class SchedulerModule {}
