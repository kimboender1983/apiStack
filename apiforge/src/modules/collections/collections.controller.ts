import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { ProjectRoleGuard } from '../../common/guards/project-role.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import type { CollectionVisibility } from '../../common/types';
import { CollectionsService } from './collections.service';

class CreateCollectionDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsEnum(['public', 'protected', 'private'])
  visibility?: string;
}

@Controller('admin/projects/:projectId/collections')
@UseGuards(JwtGuard, ProjectRoleGuard)
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get()
  list(@Param('projectId') projectId: string) {
    return this.collectionsService.list(projectId);
  }

  @Post()
  @RequireRole('editor')
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateCollectionDto,
  ) {
    return this.collectionsService.create(projectId, dto.name, dto.visibility as CollectionVisibility);
  }

  @Delete(':id')
  @RequireRole('owner')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.collectionsService.delete(projectId, id);
  }
}
