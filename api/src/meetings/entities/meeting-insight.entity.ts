import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Meeting } from './meeting.entity';

export enum InsightType {
  ACTION_ITEM = 'action_item',
  DECISION = 'decision',
  BLOCKER = 'blocker',
  FOLLOW_UP = 'follow_up',
  STATUS_UPDATE = 'status_update',
}

export enum InsightStatus {
  PENDING = 'pending',
  LINKED = 'linked',
  CREATED = 'created',
  DISMISSED = 'dismissed',
}

@Entity()
export class MeetingInsight {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  meetingId: string;

  @Column({ type: 'enum', enum: InsightType })
  insightType: InsightType;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', nullable: true })
  assignee: string; // speaker name from transcript

  @Column({ type: 'varchar', nullable: true })
  linearIssueId: string;

  @Column({ type: 'varchar', nullable: true })
  priority: string; // 'high' | 'medium' | 'low'

  @Column({ type: 'date', nullable: true })
  dueDate: Date;

  @Column({ type: 'enum', enum: InsightStatus, default: InsightStatus.PENDING })
  status: InsightStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Meeting, (meeting) => meeting.insights, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'meetingId' })
  meeting: Meeting;
}
