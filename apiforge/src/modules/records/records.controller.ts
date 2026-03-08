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
import { ApiKeyGuard, WritePermissionGuard } from '../../common/guards/api-key.guard';
import { ApiKeyCtx } from '../../common/decorators/project.decorator';
import type { ResolvedApiKey } from '../../common/types';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { RecordsService } from './records.service';

/**
 * Generic collection controller.
 * The :collection param is the slug of the collection within the resolved project.
 * Project is resolved from the API key — never from user input.
 */
@Controller('api/:collection')
@UseGuards(ApiKeyGuard)
export class RecordsController {
  constructor(
    private readonly recordsService: RecordsService,
    private readonly apiKeysService: ApiKeysService,
  ) {}

  @Get()
  async list(
    @Param('collection') collection: string,
    @Query() query: Record<string, unknown>,
    @ApiKeyCtx() apiKey: ResolvedApiKey,
  ) {
    await this.apiKeysService.checkRateLimit(apiKey);
    return this.recordsService.list(apiKey.projectId, collection, query);
  }

  @Get(':id')
  async findOne(
    @Param('collection') collection: string,
    @Param('id') id: string,
    @ApiKeyCtx() apiKey: ResolvedApiKey,
  ) {
    await this.apiKeysService.checkRateLimit(apiKey);
    return this.recordsService.findOne(apiKey.projectId, collection, id);
  }

  @Post()
  @UseGuards(WritePermissionGuard)
  async create(
    @Param('collection') collection: string,
    @Body() body: Record<string, unknown>,
    @ApiKeyCtx() apiKey: ResolvedApiKey,
  ) {
    await this.apiKeysService.checkRateLimit(apiKey);
    return this.recordsService.create(apiKey.projectId, collection, body);
  }

  @Put(':id')
  @UseGuards(WritePermissionGuard)
  async update(
    @Param('collection') collection: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @ApiKeyCtx() apiKey: ResolvedApiKey,
  ) {
    await this.apiKeysService.checkRateLimit(apiKey);
    return this.recordsService.update(apiKey.projectId, collection, id, body);
  }

  @Delete(':id')
  @UseGuards(WritePermissionGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('collection') collection: string,
    @Param('id') id: string,
    @ApiKeyCtx() apiKey: ResolvedApiKey,
  ): Promise<void> {
    await this.apiKeysService.checkRateLimit(apiKey);
    await this.recordsService.delete(apiKey.projectId, collection, id);
  }
}
