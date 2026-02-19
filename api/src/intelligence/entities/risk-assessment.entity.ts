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

export enum RiskType {
  BLOCKER_AGING = 'blocker_aging',
  VELOCITY_DECLINE = 'velocity_decline',
  SCOPE_CREEP = 'scope_creep',
  DEPENDENCY_RISK = 'dependency_risk',
  UNRESOLVED_ACTION = 'unresolved_action',
}

export enum RiskSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum RiskStatus {
  OPEN = 'open',
  ACKNOWLEDGED = 'acknowledged',
  MITIGATED = 'mitigated',
  RESOLVED = 'resolved',
}

@Entity()
export class RiskAssessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  projectId: string;

  @Column({ type: 'enum', enum: RiskType })
  riskType: RiskType;

  @Column({ type: 'enum', enum: RiskSeverity })
  severity: RiskSeverity;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', nullable: true })
  mitigation: string;

  @Column({ type: 'jsonb', nullable: true })
  evidence: Record<string, unknown>;

  @Column({ type: 'enum', enum: RiskStatus, default: RiskStatus.OPEN })
  status: RiskStatus;

  @Column({ type: 'varchar', nullable: true })
  linkedIssueId: string;

  @Column({ type: 'timestamptz' })
  detectedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;
}
