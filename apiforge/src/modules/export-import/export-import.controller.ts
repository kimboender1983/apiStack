import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { ExportImportService } from './export-import.service';

@Controller('admin/projects/:projectId')
@UseGuards(JwtGuard)
export class ExportImportController {
  constructor(private readonly service: ExportImportService) {}

  // GET /admin/projects/:projectId/collections/:slug/export?format=json|csv
  @Get('collections/:slug/export')
  async exportCollection(
    @Param('projectId') projectId: string,
    @Param('slug') slug: string,
    @Query('format') format: string = 'json',
    @Res() reply: FastifyReply,
  ) {
    if (format === 'csv') {
      const csv = await this.service.exportCollectionCsv(projectId, slug);
      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', `attachment; filename="${slug}.csv"`);
      return reply.send(csv);
    }

    const data = await this.service.exportCollectionJson(projectId, slug);
    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', `attachment; filename="${slug}.json"`);
    return reply.send(JSON.stringify(data, null, 2));
  }

  // POST /admin/projects/:projectId/collections/:slug/import
  @Post('collections/:slug/import')
  async importCollection(
    @Param('projectId') projectId: string,
    @Param('slug') slug: string,
    @Req() req: FastifyRequest & { isMultipart: () => boolean; file: () => Promise<any> },
  ) {
    if (!req.isMultipart()) throw new BadRequestException('Request must be multipart/form-data');
    const file = await req.file();
    if (!file) throw new BadRequestException('No file provided');
    const buffer = await file.toBuffer();
    return this.service.importCollection(projectId, slug, buffer.toString('utf-8'), file.filename);
  }

  // GET /admin/projects/:projectId/export
  @Get('export')
  async exportProject(@Param('projectId') projectId: string, @Res() reply: FastifyReply) {
    const data = await this.service.exportProject(projectId);
    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', `attachment; filename="project-export.json"`);
    return reply.send(JSON.stringify(data, null, 2));
  }

  // POST /admin/projects/:projectId/import
  @Post('import')
  async importProject(
    @Param('projectId') projectId: string,
    @Req() req: FastifyRequest & { isMultipart: () => boolean; file: () => Promise<any> },
  ) {
    if (!req.isMultipart()) throw new BadRequestException('Request must be multipart/form-data');
    const file = await req.file();
    if (!file) throw new BadRequestException('No file provided');
    const buffer = await file.toBuffer();
    return this.service.importProject(projectId, buffer.toString('utf-8'));
  }
}
