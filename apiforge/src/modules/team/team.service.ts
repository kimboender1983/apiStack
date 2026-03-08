import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { IsArray, IsEmail, IsEnum, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { MembersService } from '../members/members.service';

const VALID_ROLES = ['editor', 'viewer'] as const;

export class ProjectAssignment {
  @IsString()
  projectId: string;

  @IsEnum(VALID_ROLES)
  role: 'editor' | 'viewer';
}

export class BatchInviteDto {
  @IsEmail()
  email: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectAssignment)
  assignments: ProjectAssignment[];
}

@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membersService: MembersService,
  ) {}

  async getWorkspaceTeam(userId: string) {
    const ownedProjects = await this.prisma.project.findMany({
      where: { userId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const projectIds = ownedProjects.map((p) => p.id);

    if (projectIds.length === 0) {
      return { projects: [], members: [], invitations: [] };
    }

    const [allMembers, allInvitations] = await Promise.all([
      this.prisma.projectMember.findMany({
        where: { projectId: { in: projectIds } },
        include: {
          user: { select: { id: true, email: true, name: true, avatarUrl: true } },
          project: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.invitation.findMany({
        where: { projectId: { in: projectIds }, acceptedAt: null },
        include: { project: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Group members by userId
    const memberMap = new Map<
      string,
      {
        user: { id: string; email: string; name: string | null; avatarUrl: string | null };
        memberships: { id: string; projectId: string; projectName: string; role: string }[];
      }
    >();

    for (const m of allMembers) {
      if (!memberMap.has(m.userId)) {
        memberMap.set(m.userId, { user: m.user, memberships: [] });
      }
      memberMap.get(m.userId)!.memberships.push({
        id: m.id,
        projectId: m.project.id,
        projectName: m.project.name,
        role: m.role,
      });
    }

    // Group pending invitations by email
    const invitationMap = new Map<
      string,
      {
        email: string;
        projects: {
          invitationId: string;
          projectId: string;
          projectName: string;
          role: string;
          expiresAt: Date;
        }[];
      }
    >();

    for (const inv of allInvitations) {
      if (!invitationMap.has(inv.email)) {
        invitationMap.set(inv.email, { email: inv.email, projects: [] });
      }
      invitationMap.get(inv.email)!.projects.push({
        invitationId: inv.id,
        projectId: inv.project.id,
        projectName: inv.project.name,
        role: inv.role,
        expiresAt: inv.expiresAt,
      });
    }

    return {
      projects: ownedProjects,
      members: [...memberMap.values()],
      invitations: [...invitationMap.values()],
    };
  }

  async batchInvite(userId: string, dto: BatchInviteDto) {
    if (dto.assignments.length === 0) {
      throw new BadRequestException('Select at least one project');
    }

    const projectIds = dto.assignments.map((a) => a.projectId);

    const ownedProjects = await this.prisma.project.findMany({
      where: { userId, id: { in: projectIds } },
    });

    if (ownedProjects.length !== projectIds.length) {
      throw new ForbiddenException('You do not own all specified projects');
    }

    const results = await Promise.allSettled(
      dto.assignments.map((a) => this.membersService.invite(a.projectId, dto.email, a.role)),
    );

    const succeeded = results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<any>).value);

    const errors = results
      .filter((r) => r.status === 'rejected')
      .map((r, i) => ({
        projectId: dto.assignments[i].projectId,
        reason: (r as PromiseRejectedResult).reason?.message ?? 'Unknown error',
      }));

    return { invitations: succeeded, errors };
  }
}
