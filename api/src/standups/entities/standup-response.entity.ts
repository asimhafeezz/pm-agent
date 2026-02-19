import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Project } from '../../projects/entities/project.entity';

@Entity()
export class StandupResponse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  projectId: string;

  @Column({ type: 'varchar' })
  respondent: string; // name or Slack user ID

  @Column({ type: 'varchar', nullable: true })
  respondentUserId: string; // internal user ID if known

  @Column({ type: 'text', nullable: true })
  yesterday: string;

  @Column({ type: 'text', nullable: true })
  today: string;

  @Column({ type: 'text', nullable: true })
  blockers: string;

  @Column({ type: 'text' })
  rawText: string;

  @Column({ type: 'timestamptz' })
  respondedAt: Date;

  @Column({ type: 'varchar', default: 'ui' })
  source: string; // 'slack' | 'email' | 'ui'

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;
}
