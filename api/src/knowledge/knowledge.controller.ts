import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeEntityType } from './entities/knowledge-entity.entity';
import { AuthGuard } from '../auth/auth.guard';

@Controller()
@UseGuards(AuthGuard)
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get('projects/:projectId/knowledge/entities')
  findEntities(
    @Param('projectId') projectId: string,
    @Query('type') type?: KnowledgeEntityType,
  ) {
    return this.knowledgeService.findEntities(projectId, type);
  }

  @Get('projects/:projectId/knowledge/graph')
  findGraph(@Param('projectId') projectId: string) {
    return this.knowledgeService.findGraph(projectId);
  }

  @Get('projects/:projectId/knowledge/summary')
  getSummary(@Param('projectId') projectId: string) {
    return this.knowledgeService.getSummary(projectId);
  }

  @Post('projects/:projectId/knowledge/extract')
  triggerExtraction(
    @Param('projectId') projectId: string,
    @Body() body: { documentIds: string[] },
  ) {
    return this.knowledgeService.triggerExtraction(projectId, body.documentIds);
  }

  @Post('knowledge/entities')
  createEntity(@Body() data: { projectId: string; name: string; type: KnowledgeEntityType; description?: string; properties?: Record<string, unknown>; sourceDocumentIds?: string[]; embedding?: number[] }) {
    return this.knowledgeService.createEntity(data);
  }

  @Post('knowledge/entities/bulk')
  bulkCreateEntities(@Body() body: { entities: Array<{ projectId: string; name: string; type: KnowledgeEntityType; description?: string; properties?: Record<string, unknown>; sourceDocumentIds?: string[]; embedding?: number[] }> }) {
    return this.knowledgeService.bulkCreateEntities(body.entities);
  }

  @Post('knowledge/relations')
  createRelation(@Body() data: { projectId: string; sourceEntityId: string; targetEntityId: string; relationType: string; strength?: number; evidence?: string }) {
    return this.knowledgeService.createRelation(data as any);
  }

  @Post('knowledge/relations/bulk')
  bulkCreateRelations(@Body() body: { relations: Array<{ projectId: string; sourceEntityId: string; targetEntityId: string; relationType: string; strength?: number; evidence?: string }> }) {
    return this.knowledgeService.bulkCreateRelations(body.relations as any);
  }

  @Delete('knowledge/entities/:id')
  removeEntity(@Param('id') id: string) {
    return this.knowledgeService.removeEntity(id);
  }
}
