import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsObject, IsOptional, IsString } from 'class-validator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { ProjectRoleGuard } from '../../common/guards/project-role.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { FilesService } from './files.service';

class UpdateFileDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() alt?: string;
  @IsOptional() @IsString() copyright?: string;
  @IsOptional() @IsString() focus?: string;
  @IsOptional() @IsObject() metaData?: Record<string, unknown>;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

@Controller()
@UseGuards(JwtGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  // ── Global files (no project scope) ──────────────────────────────────────

  @Get('admin/files')
  listGlobal() {
    return this.filesService.listGlobal();
  }

  @Post('admin/files/upload')
  uploadGlobal(@Req() req: any) {
    return this.handleUpload(req, null);
  }

  @Put('admin/files/:id')
  updateFile(@Param('id') id: string, @Body() dto: UpdateFileDto) {
    return this.filesService.update(id, dto);
  }

  @Delete('admin/files/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFile(@Param('id') id: string): Promise<void> {
    await this.filesService.delete(id);
  }

  // ── Project-scoped files ──────────────────────────────────────────────────

  @Get('admin/projects/:projectId/files')
  @UseGuards(ProjectRoleGuard)
  listForProject(@Param('projectId') projectId: string) {
    return this.filesService.listForProject(projectId);
  }

  @Post('admin/projects/:projectId/files/upload')
  @UseGuards(ProjectRoleGuard)
  @RequireRole('editor')
  uploadToProject(@Param('projectId') projectId: string, @Req() req: any) {
    return this.handleUpload(req, projectId);
  }

  private async handleUpload(req: any, projectId: string | null) {
    if (!req.isMultipart()) {
      throw new BadRequestException('Request must be multipart/form-data');
    }
    const file = await req.file({ limits: { fileSize: MAX_FILE_SIZE } });
    if (!file) throw new BadRequestException('No file provided');
    return this.filesService.upload(file.file, file.filename, file.mimetype, projectId);
  }
}
