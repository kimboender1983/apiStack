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
import { IsString, MinLength } from 'class-validator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { AuthUser } from '../../common/decorators/project.decorator';
import { ProjectsService } from './projects.service';

class CreateProjectDto {
  @IsString()
  @MinLength(2)
  name: string;
}

@Controller('admin/projects')
@UseGuards(JwtGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  create(@Body() dto: CreateProjectDto, @AuthUser() user: { id: string }) {
    return this.projectsService.create(user.id, dto.name);
  }

  @Get()
  list(@AuthUser() user: { id: string }) {
    return this.projectsService.listForUser(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @AuthUser() user: { id: string }) {
    return this.projectsService.findOne(id, user.id);
  }

  @Get(':id/my-role')
  async myRole(@Param('id') id: string, @AuthUser() user: { id: string }) {
    const role = await this.projectsService.getMemberRole(id, user.id);
    return { role };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @AuthUser() user: { id: string }): Promise<void> {
    await this.projectsService.delete(id, user.id);
  }
}
