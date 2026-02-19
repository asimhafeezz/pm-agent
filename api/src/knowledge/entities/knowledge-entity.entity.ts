import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Project } from '../../projects/entities/project.entity';

export enum KnowledgeEntityType {
  FEATURE = 'feature',
  REQUIREMENT = 'requirement',
  USER_PERSONA = 'user_persona',
  METRIC = 'metric',
  CONSTRAINT = 'constraint',
  DEPENDENCY = 'dependency',
  TECHNOLOGY = 'technology',
  STAKEHOLDER = 'stakeholder',
}

@Entity('knowledge_entity')
export class KnowledgeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  projectId: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: KnowledgeEntityType })
  type: KnowledgeEntityType;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  properties: Record<string, unknown>;

  @Column({ type: 'uuid', array: true, nullable: true })
  sourceDocumentIds: string[];

  @Column({ type: 'float', array: true, nullable: true })
  embedding: number[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;
}
