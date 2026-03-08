import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { UploadsModule } from '../uploads/uploads.module';
import { ProjectRoleGuard } from '../../common/guards/project-role.guard';

@Module({
  imports: [UploadsModule],
  controllers: [FilesController],
  providers: [FilesService, ProjectRoleGuard],
})
export class FilesModule {}
