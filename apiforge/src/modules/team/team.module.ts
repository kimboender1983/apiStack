import { Module } from '@nestjs/common';
import { MembersModule } from '../members/members.module';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';

@Module({
  imports: [MembersModule],
  controllers: [TeamController],
  providers: [TeamService],
})
export class TeamModule {}
