import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Conversation } from '../../conversations/entities/conversation.entity';
import { AgentRun } from '../../agent-runs/entities/agent-run.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  passwordHash: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ nullable: true })
  authProvider: string | null;

  @Column({ nullable: true, unique: true })
  authProviderUserId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  authProviderMetadataJson: Record<string, unknown> | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Conversation, (conversation) => conversation.user)
  conversations: Conversation[];

  @OneToMany(() => AgentRun, (run) => run.user)
  agentRuns: AgentRun[];
}
