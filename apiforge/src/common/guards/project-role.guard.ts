import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLE_KEY, ProjectRole } from '../decorators/require-role.decorator';

const HIERARCHY: ProjectRole[] = ['viewer', 'editor', 'owner'];

function meetsRole(userRole: string, required: ProjectRole): boolean {
  const userIdx = HIERARCHY.indexOf(userRole as ProjectRole);
  const reqIdx = HIERARCHY.indexOf(required);
  return userIdx >= reqIdx;
}

@Injectable()
export class ProjectRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required: ProjectRole =
      this.reflector.getAllAndOverride<ProjectRole>(ROLE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'viewer';

    const request = context.switchToHttp().getRequest<any>();
    const userId = request.user?.id as string | undefined;
    const projectId = request.params?.projectId as string | undefined;

    if (!userId || !projectId) return false;

    const role = await this.resolveRole(projectId, userId);

    if (!meetsRole(role, required)) {
      const label = required === 'owner' ? 'project owner' : `${required} or above`;
      throw new ForbiddenException(`This action requires ${label} access`);
    }

    // Attach resolved role to request for downstream use
    request.projectRole = role;
    return true;
  }

  private async resolveRole(projectId: string, userId: string): Promise<string> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true },
    });
    if (!project) return 'none';
    if (project.userId === userId) return 'owner';

    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { role: true },
    });
    return member?.role ?? 'none';
  }
}
