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
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { ProjectRoleGuard } from '../../common/guards/project-role.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { AuthUser } from '../../common/decorators/project.decorator';
import type { ApiKeyPermission } from '../../common/types';
import { ApiKeysService } from './api-keys.service';

class CreateApiKeyDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsEnum(['read', 'write', 'admin'])
  permissions?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  rateLimitPerMinute?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  rateLimitPerHour?: number;

  @IsOptional()
  expiresAt?: Date;
}

@Controller('admin/projects/:projectId/api-keys')
@UseGuards(JwtGuard, ProjectRoleGuard)
@RequireRole('owner')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  @RequireRole('editor')
  list(@Param('projectId') projectId: string) {
    return this.apiKeysService.listForProject(projectId);
  }

  @Post()
  async create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateApiKeyDto,
    @AuthUser() user: { id: string },
  ) {
    return this.apiKeysService.create(
      projectId,
      dto.name,
      dto.permissions as ApiKeyPermission | undefined,
      dto.rateLimitPerMinute,
      dto.rateLimitPerHour,
      dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.apiKeysService.delete(id, projectId);
  }
}
