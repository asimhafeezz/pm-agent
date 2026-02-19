import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from '../../projects/entities/project.entity';

export enum JobType {
  STANDUP = 'standup',
  SPRINT_DIGEST = 'sprint_digest',
  BLOCKER_CHECK = 'blocker_check',
  RISK_DETECTION = 'risk_detection',
  WEEKLY_SUMMARY = 'weekly_summary',
}

@Entity()
export class ScheduledJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  projectId: string;

  @Column()
  userId: string;

  @Column({ type: 'enum', enum: JobType })
  jobType: JobType;

  @Column({ type: 'varchar' })
  cronExpression: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  config: Record<string, unknown>; // channel, recipients, thresholds, etc.

  @Column({ type: 'timestamptz', nullable: true })
  lastRunAt: Date;

  @Column({ type: 'varchar', nullable: true })
  lastRunStatus: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;
}
