import { Module } from '@nestjs/common';
import { ProjectManagerController } from './project-manager.controller';
import { ProjectManagerService } from './project-manager.service';
import { LinearProjectManagerProvider } from './providers/linear-project-manager.provider';

@Module({
  controllers: [ProjectManagerController],
  providers: [ProjectManagerService, LinearProjectManagerProvider],
})
export class ProjectManagerModule {}
