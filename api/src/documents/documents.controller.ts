import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  Patch,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { BulkCreateChunksDto } from './dto/bulk-create-chunks.dto';
import { UpdateDocumentStatusDto } from './dto/update-document-status.dto';
import { ImportNotionDocumentDto } from './dto/import-notion-document.dto';
import { ImportGoogleDocumentDto } from './dto/import-google-document.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller()
@UseGuards(AuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('projects/:projectId/documents')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('projectId') projectId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 })],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
    @Body() dto: CreateDocumentDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.documentsService.upload(
      projectId,
      user.id,
      dto.title,
      file,
      dto.metadata,
    );
  }

  @Post('projects/:projectId/documents/import/notion')
  importNotion(
    @Param('projectId') projectId: string,
    @Body() dto: ImportNotionDocumentDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.documentsService.importFromNotion(
      projectId,
      user.id,
      dto.page,
      dto.title,
    );
  }

  @Post('projects/:projectId/documents/import/google-doc')
  importGoogleDoc(
    @Param('projectId') projectId: string,
    @Body() dto: ImportGoogleDocumentDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.documentsService.importFromGoogleDoc(
      projectId,
      user.id,
      dto.document,
      dto.title,
    );
  }

  @Get('projects/:projectId/documents')
  findAll(@Param('projectId') projectId: string) {
    return this.documentsService.findAllByProject(projectId);
  }

  @Get('documents/:id')
  findOne(@Param('id') id: string) {
    return this.documentsService.findOne(id);
  }

  @Delete('documents/:id')
  remove(@Param('id') id: string) {
    return this.documentsService.remove(id);
  }

  @Post('documents/:id/reprocess')
  reprocess(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.documentsService.reprocess(id, user.id);
  }

  @Post('documents/:id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateDocumentStatusDto) {
    return this.documentsService.updateStatus(
      id,
      dto.status,
      dto.processingError,
      dto.chunkCount,
    );
  }

  @Patch('documents/:id/status')
  patchStatus(@Param('id') id: string, @Body() dto: UpdateDocumentStatusDto) {
    return this.documentsService.updateStatus(
      id,
      dto.status,
      dto.processingError,
      dto.chunkCount,
    );
  }

  @Get('documents/:id/chunks')
  findChunks(@Param('id') id: string) {
    return this.documentsService.findChunks(id);
  }

  @Post('documents/:id/chunks')
  bulkCreateChunks(
    @Param('id') id: string,
    @Body() dto: BulkCreateChunksDto,
  ) {
    return this.documentsService.bulkCreateChunks(id, dto.chunks);
  }
}
