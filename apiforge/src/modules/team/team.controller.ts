import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { AuthUser } from '../../common/decorators/project.decorator';
import { BatchInviteDto, TeamService } from './team.service';

@Controller('admin/team')
@UseGuards(JwtGuard)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get()
  getWorkspaceTeam(@AuthUser() user: { id: string }) {
    return this.teamService.getWorkspaceTeam(user.id);
  }

  @Post('invite')
  batchInvite(@AuthUser() user: { id: string }, @Body() dto: BatchInviteDto) {
    return this.teamService.batchInvite(user.id, dto);
  }
}
