import { Module } from '@nestjs/common';
import { CollectionsService } from './collections.service';
import { CollectionsController } from './collections.controller';
import { ProjectRoleGuard } from '../../common/guards/project-role.guard';

@Module({
  providers: [CollectionsService, ProjectRoleGuard],
  controllers: [CollectionsController],
  exports: [CollectionsService],
})
export class CollectionsModule {}
