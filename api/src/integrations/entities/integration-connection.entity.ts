import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export enum IntegrationProvider {
  LINEAR = 'linear',
  NOTION = 'notion',
  GOOGLE_DOCS = 'google-docs',
  GMAIL = 'gmail',
  SLACK = 'slack',
}

@Entity()
@Unique(['userId', 'provider'])
export class IntegrationConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ type: 'varchar' })
  provider: IntegrationProvider;

  @Column({ type: 'text' })
  accessTokenEnc: string;

  @Column({ type: 'text', nullable: true })
  refreshTokenEnc: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  accessTokenExpiresAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  tokenType: string | null;

  @Column({ type: 'text', nullable: true })
  scope: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
