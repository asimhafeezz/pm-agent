import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { AgentRun } from './agent-run.entity';

@Entity()
export class ToolCall {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  runId: string;

  @Column()
  toolName: string;

  @Column({ type: 'jsonb' })
  requestJson: any;

  @Column({ type: 'jsonb' })
  responseJson: any;

  @Column('float')
  latencyMs: number;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => AgentRun, (run) => run.toolCalls)
  @JoinColumn({ name: 'runId' })
  run: AgentRun;
}
