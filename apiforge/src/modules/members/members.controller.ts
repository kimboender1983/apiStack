import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsEmail, IsEnum, IsString } from 'class-validator';
import { AuthUser } from '../../common/decorators/project.decorator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { ProjectRoleGuard } from '../../common/guards/project-role.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { MembersService } from './members.service';

const VALID_ROLES = ['editor', 'viewer'] as const;
type Role = (typeof VALID_ROLES)[number];

class InviteDto {
  @IsEmail()
  email: string;

  @IsEnum(VALID_ROLES)
  role: Role;
}

class UpdateRoleDto {
  @IsEnum(VALID_ROLES)
  role: Role;
}

// Admin-only routes (require JWT)
@Controller('admin/projects/:projectId/members')
@UseGuards(JwtGuard, ProjectRoleGuard)
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @RequireRole('editor')
  list(@Param('projectId') projectId: string) {
    return this.membersService.list(projectId);
  }

  @Post('invite')
  @RequireRole('owner')
  invite(@Param('projectId') projectId: string, @Body() dto: InviteDto) {
    return this.membersService.invite(projectId, dto.email, dto.role);
  }

  @Patch(':memberId')
  @RequireRole('owner')
  updateRole(
    @Param('projectId') projectId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.membersService.updateRole(projectId, memberId, dto.role);
  }

  @Delete('invitations/:invitationId')
  @RequireRole('owner')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelInvitation(
    @Param('projectId') projectId: string,
    @Param('invitationId') invitationId: string,
  ): Promise<void> {
    await this.membersService.cancelInvitation(projectId, invitationId);
  }

  @Delete(':memberId')
  @RequireRole('owner')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Param('projectId') projectId: string,
    @Param('memberId') memberId: string,
  ): Promise<void> {
    await this.membersService.removeMember(projectId, memberId);
  }
}

// Invitation accept routes (GET = public, POST = requires JWT)
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly membersService: MembersService) {}

  @Get(':token')
  getInvitation(@Param('token') token: string) {
    return this.membersService.getInvitation(token);
  }

  @Post('accept')
  @UseGuards(JwtGuard)
  acceptInvitation(
    @AuthUser() user: { id: string },
    @Body() body: { token: string },
  ) {
    return this.membersService.acceptInvitation(body.token, user.id);
  }
}
