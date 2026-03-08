import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { ProjectRoleGuard } from '../../common/guards/project-role.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { FieldsService } from './fields.service';

const FIELD_TYPES = ['string', 'text', 'richtext', 'integer', 'float', 'boolean', 'date', 'datetime', 'json', 'enum', 'file'];

class CreateFieldDto {
  @IsString()
  name: string;

  @IsEnum(FIELD_TYPES)
  type: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsString()
  defaultValue?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enumValues?: string[];
}

class UpdateFieldDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(FIELD_TYPES)
  type?: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsString()
  defaultValue?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enumValues?: string[];
}

@Controller('admin/projects/:projectId/collections/:collectionId/fields')
@UseGuards(JwtGuard, ProjectRoleGuard)
@RequireRole('editor')
export class FieldsController {
  constructor(private readonly fieldsService: FieldsService) {}

  @Get()
  @RequireRole('viewer')
  list(@Param('collectionId') collectionId: string) {
    return this.fieldsService.list(collectionId);
  }

  @Post()
  create(@Param('collectionId') collectionId: string, @Body() dto: CreateFieldDto) {
    return this.fieldsService.create(collectionId, dto as any);
  }

  @Put(':id')
  update(
    @Param('collectionId') collectionId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFieldDto,
  ) {
    return this.fieldsService.update(id, collectionId, dto as any);
  }

  @Patch('reorder')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reorder(
    @Param('collectionId') collectionId: string,
    @Body() body: { ids: string[] },
  ): Promise<void> {
    await this.fieldsService.reorder(collectionId, body.ids);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('collectionId') collectionId: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.fieldsService.delete(id, collectionId);
  }
}
