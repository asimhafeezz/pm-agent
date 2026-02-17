import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Conversation } from '../../conversations/entities/conversation.entity';
import { ToolCall } from './tool-call.entity';
import { AgentRunEvent } from './agent-run-event.entity';

export enum AgentRunStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity()
export class AgentRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  conversationId: string;

  @Column({
    type: 'enum',
    enum: AgentRunStatus,
    default: AgentRunStatus.RUNNING,
  })
  status: AgentRunStatus;

  @Column({ nullable: true })
  finalAnswerText: string;

  @CreateDateColumn()
  startedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @ManyToOne(() => User, (user) => user.agentRuns)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Conversation, (conversation) => conversation.agentRuns)
  @JoinColumn({ name: 'conversationId' })
  conversation: Conversation;

  @OneToMany(() => ToolCall, (toolCall) => toolCall.run)
  toolCalls: ToolCall[];

  @OneToMany(() => AgentRunEvent, (event) => event.run)
  events: AgentRunEvent[];
}
