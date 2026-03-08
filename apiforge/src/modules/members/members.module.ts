import { Module } from '@nestjs/common';
import { InvitationsController, MembersController } from './members.controller';
import { MembersService } from './members.service';
import { ProjectRoleGuard } from '../../common/guards/project-role.guard';

@Module({
  providers: [MembersService, ProjectRoleGuard],
  controllers: [MembersController, InvitationsController],
  exports: [MembersService],
})
export class MembersModule {}
