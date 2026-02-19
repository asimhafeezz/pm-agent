import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Message } from './message.entity';
import { AgentRun } from '../../agent-runs/entities/agent-run.entity';

@Entity()
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ type: 'uuid', nullable: true })
  projectId: string;

  @Column({ nullable: true })
  title: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.conversations)
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => Message, (message) => message.conversation)
  messages: Message[];

  @OneToMany(() => AgentRun, (run) => run.conversation)
  agentRuns: AgentRun[];
}
