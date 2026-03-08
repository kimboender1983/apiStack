import { Module } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysController } from './api-keys.controller';
import { ProjectRoleGuard } from '../../common/guards/project-role.guard';

@Module({
  providers: [ApiKeysService, ProjectRoleGuard],
  controllers: [ApiKeysController],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
