import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { AgentRun } from './agent-run.entity';

@Entity()
export class AgentRunEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  runId: string;

  @Column()
  type: string;

  @Column({ type: 'jsonb' })
  payloadJson: any;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => AgentRun, (run) => run.events)
  @JoinColumn({ name: 'runId' })
  run: AgentRun;
}
