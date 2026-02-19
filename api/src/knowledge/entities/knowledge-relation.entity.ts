import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Project } from '../../projects/entities/project.entity';
import { KnowledgeEntity } from './knowledge-entity.entity';

export enum RelationType {
  DEPENDS_ON = 'depends_on',
  BLOCKS = 'blocks',
  RELATED_TO = 'related_to',
  PART_OF = 'part_of',
  IMPLEMENTS = 'implements',
  CONTRADICTS = 'contradicts',
}

@Entity('knowledge_relation')
export class KnowledgeRelation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  projectId: string;

  @Column()
  sourceEntityId: string;

  @Column()
  targetEntityId: string;

  @Column({ type: 'enum', enum: RelationType })
  relationType: RelationType;

  @Column({ type: 'float', default: 1.0 })
  strength: number;

  @Column({ type: 'text', nullable: true })
  evidence: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @ManyToOne(() => KnowledgeEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sourceEntityId' })
  sourceEntity: KnowledgeEntity;

  @ManyToOne(() => KnowledgeEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'targetEntityId' })
  targetEntity: KnowledgeEntity;
}
