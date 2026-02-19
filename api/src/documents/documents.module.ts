import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { Document } from './entities/document.entity';
import { DocumentChunk } from './entities/document-chunk.entity';
import { FilesModule } from '../files/files.module';
import { GatewayModule } from '../gateway/gateway.module';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, DocumentChunk]),
    MulterModule.register({ storage: undefined }),
    FilesModule,
    GatewayModule,
    IntegrationsModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
