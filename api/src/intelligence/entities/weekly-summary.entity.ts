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
export class WeeklySummary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  projectId: string;

  @Column({ type: 'text' })
  executiveSummary: string;

  @Column({ type: 'jsonb', nullable: true })
  metrics: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  highlights: Record<string, unknown>[];

  @Column({ type: 'jsonb', nullable: true })
  risks: Record<string, unknown>[];

  @Column({ type: 'jsonb', nullable: true })
  recommendations: Record<string, unknown>[];

  @Column({ type: 'timestamptz' })
  periodStart: Date;

  @Column({ type: 'timestamptz' })
  periodEnd: Date;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;
}
