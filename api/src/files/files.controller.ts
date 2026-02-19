import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { AuthGuard } from '../auth/auth.guard';
import { randomUUID } from 'crypto';

@Controller('files')
@UseGuards(AuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided.');

    const ext = file.originalname.split('.').pop() || '';
    const key = `documents/${randomUUID()}.${ext}`;

    const result = await this.filesService.upload(file, key);
    return {
      key: result.key,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      size: result.size,
    };
  }

  @Get(':key(*)')
  async getPresignedUrl(@Param('key') key: string) {
    const url = await this.filesService.getPresignedUrl(key);
    return { url };
  }
}
