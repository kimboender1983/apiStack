import { Module } from '@nestjs/common';
import { RelationsService } from './relations.service';
import { RelationsController } from './relations.controller';
import { ProjectRoleGuard } from '../../common/guards/project-role.guard';

@Module({
  providers: [RelationsService, ProjectRoleGuard],
  controllers: [RelationsController],
  exports: [RelationsService],
})
export class RelationsModule {}
