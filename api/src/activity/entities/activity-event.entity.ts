import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class ActivityEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  projectId: string;

  @Column({ nullable: true })
  userId: string;

  @Column({ type: 'varchar' })
  source: string; // 'linear' | 'gmail' | 'notion' | 'agent' | 'meeting' | 'manual'

  @Column({ type: 'varchar' })
  eventType: string; // 'issue_created' | 'issue_updated' | 'email_received' | 'doc_updated' | etc.

  @Column({ type: 'varchar', nullable: true })
  externalId: string;

  @Column({ type: 'text', nullable: true })
  title: string;

  @Column({ type: 'text', nullable: true })
  summary: string;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  occurredAt: Date;
}
