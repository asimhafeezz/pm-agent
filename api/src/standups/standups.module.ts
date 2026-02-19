import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StandupResponse } from './entities/standup-response.entity';
import { StandupsController } from './standups.controller';
import { StandupsService } from './standups.service';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([StandupResponse]),
    ActivityModule,
  ],
  controllers: [StandupsController],
  providers: [StandupsService],
  exports: [StandupsService],
})
export class StandupsModule {}
