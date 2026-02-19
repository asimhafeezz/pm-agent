import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { KnowledgeEntity, KnowledgeEntityType } from './entities/knowledge-entity.entity';
import { KnowledgeRelation } from './entities/knowledge-relation.entity';

@Injectable()
export class KnowledgeService {
  private agentBaseUrl: string;

  constructor(
    @InjectRepository(KnowledgeEntity)
    private readonly entityRepo: Repository<KnowledgeEntity>,
    @InjectRepository(KnowledgeRelation)
    private readonly relationRepo: Repository<KnowledgeRelation>,
    private readonly configService: ConfigService,
  ) {
    this.agentBaseUrl =
      this.configService.get('AGENT_BASE_URL') || 'http://localhost:8000';
  }

  async findEntities(
    projectId: string,
    type?: KnowledgeEntityType,
  ): Promise<KnowledgeEntity[]> {
    const where: Record<string, unknown> = { projectId };
    if (type) where.type = type;
    return this.entityRepo.find({ where, order: { name: 'ASC' } });
  }

  async findGraph(
    projectId: string,
  ): Promise<{ entities: KnowledgeEntity[]; relations: KnowledgeRelation[] }> {
    const [entities, relations] = await Promise.all([
      this.entityRepo.find({ where: { projectId } }),
      this.relationRepo.find({ where: { projectId } }),
    ]);
    return { entities, relations };
  }

  async findOneEntity(id: string): Promise<KnowledgeEntity> {
    const entity = await this.entityRepo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Knowledge entity not found');
    return entity;
  }

  async removeEntity(id: string): Promise<void> {
    const entity = await this.findOneEntity(id);
    await this.relationRepo.delete([
      { sourceEntityId: id },
      { targetEntityId: id },
    ]);
    await this.entityRepo.remove(entity);
  }

  async createEntity(
    data: Partial<KnowledgeEntity>,
  ): Promise<KnowledgeEntity> {
    const entity = this.entityRepo.create(data);
    return this.entityRepo.save(entity);
  }

  async bulkCreateEntities(
    entities: Array<Partial<KnowledgeEntity>>,
  ): Promise<KnowledgeEntity[]> {
    const created = entities.map((e) => this.entityRepo.create(e));
    return this.entityRepo.save(created);
  }

  async createRelation(
    data: Partial<KnowledgeRelation>,
  ): Promise<KnowledgeRelation> {
    const relation = this.relationRepo.create(data);
    return this.relationRepo.save(relation);
  }

  async bulkCreateRelations(
    relations: Array<Partial<KnowledgeRelation>>,
  ): Promise<KnowledgeRelation[]> {
    const created = relations.map((r) => this.relationRepo.create(r));
    return this.relationRepo.save(created);
  }

  async triggerExtraction(
    projectId: string,
    documentIds: string[],
  ): Promise<{ status: string }> {
    const url = `${this.agentBaseUrl}/agent/extract-knowledge`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, documentIds }),
    });
    if (!response.ok) {
      throw new Error(`Agent returned ${response.status}`);
    }
    return { status: 'extraction_started' };
  }

  async getSummary(projectId: string): Promise<{ entityCount: number; relationCount: number; byType: Record<string, number> }> {
    const entities = await this.entityRepo.find({ where: { projectId } });
    const relationCount = await this.relationRepo.count({ where: { projectId } });
    const byType: Record<string, number> = {};
    for (const e of entities) {
      byType[e.type] = (byType[e.type] || 0) + 1;
    }
    return { entityCount: entities.length, relationCount, byType };
  }
}
