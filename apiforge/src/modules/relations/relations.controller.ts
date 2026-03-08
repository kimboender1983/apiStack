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
import { IsEnum, IsString } from 'class-validator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { ProjectRoleGuard } from '../../common/guards/project-role.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import type { RelationType } from '../../common/types';
import { RelationsService } from './relations.service';

class CreateRelationDto {
  @IsString()
  fieldName: string;

  @IsEnum(['one_to_one', 'one_to_many', 'many_to_many'])
  relationType: string;

  @IsString()
  targetCollectionId: string;
}

@Controller('admin/projects/:projectId/collections/:collectionId/relations')
@UseGuards(JwtGuard, ProjectRoleGuard)
export class RelationsController {
  constructor(private readonly relationsService: RelationsService) {}

  @Get()
  list(@Param('collectionId') collectionId: string) {
    return this.relationsService.list(collectionId);
  }

  @Post()
  @RequireRole('editor')
  create(
    @Param('collectionId') collectionId: string,
    @Body() dto: CreateRelationDto,
  ) {
    return this.relationsService.create(
      collectionId,
      dto.fieldName,
      dto.relationType as RelationType,
      dto.targetCollectionId,
    );
  }

  @Delete(':id')
  @RequireRole('editor')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('collectionId') collectionId: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.relationsService.delete(id, collectionId);
  }
}
