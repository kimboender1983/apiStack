import { Module } from '@nestjs/common';
import { FieldsService } from './fields.service';
import { FieldsController } from './fields.controller';
import { ProjectRoleGuard } from '../../common/guards/project-role.guard';

@Module({
  providers: [FieldsService, ProjectRoleGuard],
  controllers: [FieldsController],
  exports: [FieldsService],
})
export class FieldsModule {}
