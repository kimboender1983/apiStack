import {
  BadRequestException,
  Controller,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { StorageService } from './storage.service';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

@Controller('admin/projects/:projectId/upload')
@UseGuards(JwtGuard)
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  @Post()
  async upload(@Param('projectId') projectId: string, @Req() req: any) {
    if (!req.isMultipart()) {
      throw new BadRequestException('Request must be multipart/form-data');
    }

    const file = await req.file({ limits: { fileSize: MAX_FILE_SIZE } });
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const stored = await this.storage.save(
      file.file,
      file.filename,
      file.mimetype,
      projectId,
    );

    return stored;
  }
}
