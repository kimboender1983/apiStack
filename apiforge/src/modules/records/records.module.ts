import { Module } from '@nestjs/common';
import { RecordsService } from './records.service';
import { RecordsController } from './records.controller';
import { AdminRecordsController } from './admin-records.controller';
import { CollectionsModule } from '../collections/collections.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { ProjectRoleGuard } from '../../common/guards/project-role.guard';

@Module({
  imports: [CollectionsModule, ApiKeysModule],
  providers: [RecordsService, ProjectRoleGuard],
  controllers: [RecordsController, AdminRecordsController],
})
export class RecordsModule {}
