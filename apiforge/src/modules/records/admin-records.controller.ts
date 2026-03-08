import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { ProjectRoleGuard } from '../../common/guards/project-role.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { RecordsService } from './records.service';

@Controller('admin/projects/:projectId/collections/:collectionSlug/records')
@UseGuards(JwtGuard, ProjectRoleGuard)
export class AdminRecordsController {
  constructor(private readonly recordsService: RecordsService) {}

  @Get()
  list(
    @Param('projectId') projectId: string,
    @Param('collectionSlug') collectionSlug: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.recordsService.list(projectId, collectionSlug, query);
  }

  @Get(':id')
  findOne(
    @Param('projectId') projectId: string,
    @Param('collectionSlug') collectionSlug: string,
    @Param('id') id: string,
  ) {
    return this.recordsService.findOne(projectId, collectionSlug, id);
  }

  @Post()
  @RequireRole('editor')
  create(
    @Param('projectId') projectId: string,
    @Param('collectionSlug') collectionSlug: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.recordsService.create(projectId, collectionSlug, body);
  }

  @Put(':id')
  @RequireRole('editor')
  update(
    @Param('projectId') projectId: string,
    @Param('collectionSlug') collectionSlug: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.recordsService.update(projectId, collectionSlug, id, body);
  }

  @Delete(':id')
  @RequireRole('editor')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('projectId') projectId: string,
    @Param('collectionSlug') collectionSlug: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.recordsService.delete(projectId, collectionSlug, id);
  }
}
