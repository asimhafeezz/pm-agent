import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Document } from './document.entity';

@Entity()
export class DocumentChunk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  documentId: string;

  @Column({ type: 'int' })
  chunkIndex: number;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'float', array: true, nullable: true })
  embedding: number[];

  @Column({ type: 'int', default: 0 })
  tokenCount: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Document, (doc) => doc.chunks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'documentId' })
  document: Document;
}
