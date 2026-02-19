import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class FilesService implements OnModuleInit {
  private readonly logger = new Logger(FilesService.name);
  private minioClient: Minio.Client;
  private bucket: string;
  private initialized = false;
  private endpoint: string;
  private port: number;

  constructor(private configService: ConfigService) {
    this.bucket = this.configService.get('MINIO_BUCKET') || 'agentpm';
    this.endpoint = this.configService.get('MINIO_ENDPOINT') || 'localhost';
    this.port = parseInt(this.configService.get('MINIO_PORT') || '9001', 10);
    this.minioClient = new Minio.Client({
      endPoint: this.endpoint,
      port: this.port,
      useSSL: false,
      accessKey: this.configService.get('MINIO_ACCESS_KEY') || 'minioadmin',
      secretKey: this.configService.get('MINIO_SECRET_KEY') || 'minioadmin',
    });
  }

  async onModuleInit() {
    try {
      const exists = await this.minioClient.bucketExists(this.bucket);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucket);
      }
      this.initialized = true;
      this.logger.log(
        `File storage initialized (MinIO ${this.endpoint}:${this.port}, bucket=${this.bucket})`,
      );
    } catch (error) {
      this.initialized = false;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `MinIO is unavailable at ${this.endpoint}:${this.port}. API will stay up, but file upload endpoints will fail until MinIO is running. Root cause: ${message}`,
      );
    }
  }

  private ensureReady() {
    if (this.initialized) return;
    throw new ServiceUnavailableException(
      `File storage backend unavailable. Start MinIO at ${this.endpoint}:${this.port} and restart API.`,
    );
  }

  async upload(
    file: Express.Multer.File,
    key: string,
  ): Promise<{ key: string; size: number }> {
    this.ensureReady();
    await this.minioClient.putObject(this.bucket, key, file.buffer, file.size, {
      'Content-Type': file.mimetype,
    });
    return { key, size: file.size };
  }

  async getPresignedUrl(key: string, expirySeconds = 3600): Promise<string> {
    this.ensureReady();
    return this.minioClient.presignedGetObject(this.bucket, key, expirySeconds);
  }

  async getObject(key: string): Promise<Buffer> {
    this.ensureReady();
    const stream = await this.minioClient.getObject(this.bucket, key);
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  async delete(key: string): Promise<void> {
    this.ensureReady();
    await this.minioClient.removeObject(this.bucket, key);
  }
}
