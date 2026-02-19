import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Document, DocumentStatus } from './entities/document.entity';
import { DocumentChunk } from './entities/document-chunk.entity';
import { FilesService } from '../files/files.service';
import { EventsGateway } from '../gateway/events.gateway';
import { randomUUID } from 'crypto';
import { IntegrationsService } from '../integrations/integrations.service';

@Injectable()
export class DocumentsService {
  private agentBaseUrl: string;

  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(DocumentChunk)
    private readonly chunkRepo: Repository<DocumentChunk>,
    private readonly filesService: FilesService,
    private readonly eventsGateway: EventsGateway,
    private readonly integrationsService: IntegrationsService,
    private readonly configService: ConfigService,
  ) {
    this.agentBaseUrl =
      this.configService.get('AGENT_BASE_URL') || 'http://localhost:8000';
  }

  async upload(
    projectId: string,
    userId: string,
    title: string,
    file: Express.Multer.File,
    metadata?: Record<string, unknown>,
  ): Promise<Document> {
    const s3Key = `documents/${projectId}/${randomUUID()}/${file.originalname}`;
    await this.filesService.upload(file, s3Key);

    const doc = this.documentRepo.create({
      projectId,
      uploadedById: userId,
      title: title || file.originalname,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      s3Key,
      status: DocumentStatus.PENDING,
      metadata,
    });
    const saved = await this.documentRepo.save(doc);

    saved.status = DocumentStatus.PROCESSING;
    await this.documentRepo.save(saved);

    // Trigger async processing via agent
    this.triggerProcessing(saved).catch((err) => {
      console.error(`[DocumentsService] Failed to trigger processing for ${saved.id}:`, err);
      this.markDocumentFailed(saved.id, err).catch(() => undefined);
    });

    return saved;
  }

  async findAllByProject(projectId: string): Promise<Document[]> {
    return this.documentRepo.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Document> {
    const doc = await this.documentRepo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async findChunks(documentId: string): Promise<DocumentChunk[]> {
    await this.findOne(documentId);
    return this.chunkRepo.find({
      where: { documentId },
      order: { chunkIndex: 'ASC' },
    });
  }

  async remove(id: string): Promise<void> {
    const doc = await this.findOne(id);
    if (!doc.s3Key.startsWith('external://')) {
      await this.filesService.delete(doc.s3Key);
    }
    await this.chunkRepo.delete({ documentId: id });
    await this.documentRepo.remove(doc);
  }

  async updateStatus(
    id: string,
    status: DocumentStatus,
    processingError?: string,
    chunkCount?: number,
  ): Promise<Document> {
    const doc = await this.findOne(id);
    doc.status = status;
    if (processingError !== undefined) doc.processingError = processingError;
    if (chunkCount !== undefined) doc.chunkCount = chunkCount;
    const saved = await this.documentRepo.save(doc);

    this.eventsGateway.emitToProject(doc.projectId, 'document:status', {
      documentId: id,
      status,
      chunkCount,
    });

    return saved;
  }

  async bulkCreateChunks(
    documentId: string,
    chunks: Array<{
      chunkIndex: number;
      content: string;
      embedding?: number[];
      tokenCount?: number;
      metadata?: Record<string, unknown>;
    }>,
  ): Promise<number> {
    const entities = chunks.map((c) =>
      this.chunkRepo.create({
        documentId,
        chunkIndex: c.chunkIndex,
        content: c.content,
        embedding: c.embedding,
        tokenCount: c.tokenCount || 0,
        metadata: c.metadata,
      }),
    );
    await this.chunkRepo.save(entities);
    return entities.length;
  }

  async reprocess(id: string, userId: string): Promise<Document> {
    const doc = await this.findOne(id);
    if (doc.s3Key.startsWith('external://')) {
      return this.reprocessExternalDocument(doc, userId);
    }
    await this.chunkRepo.delete({ documentId: id });
    doc.status = DocumentStatus.PROCESSING;
    doc.processingError = null;
    doc.chunkCount = 0;
    const saved = await this.documentRepo.save(doc);
    this.triggerProcessing(saved).catch((err) => {
      console.error(`[DocumentsService] Failed to trigger reprocessing for ${id}:`, err);
      this.markDocumentFailed(saved.id, err).catch(() => undefined);
    });
    return saved;
  }

  private async reprocessExternalDocument(doc: Document, userId: string): Promise<Document> {
    const metadata = (doc.metadata || {}) as Record<string, unknown>;
    const rawSourceType = String(metadata.sourceType || '').trim().toLowerCase();
    const provider =
      rawSourceType === 'notion'
        ? 'notion'
        : rawSourceType === 'google_docs' || rawSourceType === 'google-docs'
          ? 'google-docs'
          : '';
    if (!provider) {
      throw new BadRequestException(
        'Cannot reprocess external document: missing sourceType in metadata.',
      );
    }

    const sourceInput = String(metadata.sourceInput || '').trim();
    const sourceId = String(metadata.sourceId || '').trim();
    const source = sourceInput || sourceId;
    if (!source) {
      throw new BadRequestException(
        'Cannot reprocess external document: missing sourceInput/sourceId in metadata.',
      );
    }

    const payload = await this.fetchSourceDocument(userId, provider, source);
    const text = payload.text;
    if (!text.trim()) {
      throw new BadRequestException('The selected source has no extractable text');
    }

    await this.chunkRepo.delete({ documentId: doc.id });
    doc.status = DocumentStatus.PROCESSING;
    doc.processingError = null;
    doc.chunkCount = 0;
    doc.fileSize = Buffer.byteLength(text, 'utf-8');
    if (payload.title) {
      doc.title = payload.title;
    }
    doc.metadata = {
      ...(doc.metadata || {}),
      sourceType: provider === 'google-docs' ? 'google_docs' : 'notion',
      sourceId: payload.sourceId,
      sourceInput: sourceInput || source,
    };
    const saved = await this.documentRepo.save(doc);

    this.triggerTextProcessing(saved, text).catch((err) => {
      console.error(`[DocumentsService] Failed to reprocess external document ${saved.id}:`, err);
      this.markDocumentFailed(saved.id, err).catch(() => undefined);
    });

    return saved;
  }

  async importFromNotion(
    projectId: string,
    userId: string,
    pageInput: string,
    title?: string,
  ): Promise<Document> {
    const payload = await this.fetchSourceDocument(userId, 'notion', pageInput);
    const sourceId = payload.sourceId;
    const text = payload.text;

    if (!text.trim()) {
      throw new BadRequestException('The selected Notion page has no extractable text');
    }

    const doc = this.documentRepo.create({
      projectId,
      uploadedById: userId,
      title: title || payload.title || `Notion ${sourceId}`,
      originalFilename: `${sourceId}.md`,
      mimeType: 'text/markdown',
      fileSize: Buffer.byteLength(text, 'utf-8'),
      s3Key: `external://notion/${sourceId}`,
      status: DocumentStatus.PENDING,
      metadata: {
        sourceType: 'notion',
        sourceId,
        sourceInput: pageInput,
      },
    });
    const saved = await this.documentRepo.save(doc);

    saved.status = DocumentStatus.PROCESSING;
    await this.documentRepo.save(saved);

    this.triggerTextProcessing(saved, text).catch((err) => {
      console.error(`[DocumentsService] Failed to import notion page ${sourceId}:`, err);
      this.markDocumentFailed(saved.id, err).catch(() => undefined);
    });

    return saved;
  }

  async importFromGoogleDoc(
    projectId: string,
    userId: string,
    docInput: string,
    title?: string,
  ): Promise<Document> {
    const payload = await this.fetchSourceDocument(userId, 'google-docs', docInput);
    const sourceId = payload.sourceId;
    const text = payload.text;

    if (!text.trim()) {
      throw new BadRequestException('The selected Google Doc has no extractable text');
    }

    const doc = this.documentRepo.create({
      projectId,
      uploadedById: userId,
      title: title || payload.title || `Google Doc ${sourceId}`,
      originalFilename: `${sourceId}.txt`,
      mimeType: 'text/plain',
      fileSize: Buffer.byteLength(text, 'utf-8'),
      s3Key: `external://google-docs/${sourceId}`,
      status: DocumentStatus.PENDING,
      metadata: {
        sourceType: 'google_docs',
        sourceId,
        sourceInput: docInput,
      },
    });
    const saved = await this.documentRepo.save(doc);

    saved.status = DocumentStatus.PROCESSING;
    await this.documentRepo.save(saved);

    this.triggerTextProcessing(saved, text).catch((err) => {
      console.error(`[DocumentsService] Failed to import google doc ${sourceId}:`, err);
      this.markDocumentFailed(saved.id, err).catch(() => undefined);
    });

    return saved;
  }

  private async triggerProcessing(doc: Document): Promise<void> {
    const url = `${this.agentBaseUrl}/agent/process-document`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentId: doc.id,
        s3Key: doc.s3Key,
        mimeType: doc.mimeType,
        projectId: doc.projectId,
      }),
    });
    if (!response.ok) {
      throw new Error(`Agent returned ${response.status}`);
    }
  }

  private async triggerTextProcessing(doc: Document, text: string): Promise<void> {
    const url = `${this.agentBaseUrl}/agent/process-document-text`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentId: doc.id,
        projectId: doc.projectId,
        text,
      }),
    });
    if (!response.ok) {
      throw new Error(`Agent returned ${response.status}`);
    }
  }

  private async fetchSourceDocument(
    userId: string,
    provider: 'notion' | 'google-docs',
    source: string,
  ) {
    const raw = await this.integrationsService.fetchDocumentSource(userId, provider, source);

    const payload =
      raw && typeof raw === 'object' && 'data' in (raw as Record<string, unknown>)
        ? ((raw as Record<string, unknown>).data as Record<string, unknown>)
        : (raw as Record<string, unknown>);

    const sourceId = String(payload?.sourceId || '').trim();
    const title = String(payload?.title || '').trim();
    const text = String(payload?.text || '');

    if (!sourceId) {
      throw new BadRequestException(`Integration response for ${provider} is missing sourceId`);
    }

    return { sourceId, title, text };
  }

  private async markDocumentFailed(documentId: string, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : 'Unknown processing error';
    try {
      await this.updateStatus(documentId, DocumentStatus.FAILED, message);
    } catch {
      // no-op: best effort status update
    }
  }
}
