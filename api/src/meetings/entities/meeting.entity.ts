import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from '../../projects/entities/project.entity';
import { User } from '../../users/entities/user.entity';
import { MeetingInsight } from './meeting-insight.entity';

export enum MeetingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  FAILED = 'failed',
}

@Entity()
export class Meeting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  projectId: string;

  @Column()
  createdById: string;

  @Column()
  title: string;

  @Column({ type: 'timestamptz', nullable: true })
  meetingDate: Date;

  @Column({ type: 'text' })
  rawTranscript: string;

  @Column({ type: 'enum', enum: MeetingStatus, default: MeetingStatus.PENDING })
  status: MeetingStatus;

  @Column({ type: 'varchar', default: 'upload' })
  source: string; // 'upload' | 'zoom' | 'google_meet' | 'otter' | 'fireflies'

  @Column({ type: 'int', nullable: true })
  durationMinutes: number;

  @Column({ type: 'text', nullable: true })
  processingError: string;

  @Column({ type: 'int', default: 0 })
  insightCount: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @OneToMany(() => MeetingInsight, (insight) => insight.meeting)
  insights: MeetingInsight[];
}
