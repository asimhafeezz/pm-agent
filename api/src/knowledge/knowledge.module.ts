import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeEntity } from './entities/knowledge-entity.entity';
import { KnowledgeRelation } from './entities/knowledge-relation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([KnowledgeEntity, KnowledgeRelation])],
  controllers: [KnowledgeController],
  providers: [KnowledgeService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
