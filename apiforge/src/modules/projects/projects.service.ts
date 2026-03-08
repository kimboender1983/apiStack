import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, name: string): Promise<object> {
    const slug = this.slugify(name);

    const existing = await this.prisma.project.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException(`Project slug "${slug}" already taken`);
    }

    return this.prisma.project.create({
      data: { userId, name, slug },
    });
  }

  async listForUser(userId: string) {
    const ownerSelect = { select: { id: true, name: true, email: true } };
    const [owned, memberships] = await Promise.all([
      this.prisma.project.findMany({
        where: { userId },
        include: { user: ownerSelect },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.projectMember.findMany({
        where: { userId },
        include: { project: { include: { user: ownerSelect } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const memberProjects = memberships.map((m) => m.project);
    const all = [...owned, ...memberProjects];
    // Deduplicate by id (owner who is also a member)
    return all.filter((p, i) => all.findIndex((x) => x.id === p.id) === i);
  }

  async findOne(id: string, userId: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.userId === userId) return project;

    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId } },
    });
    if (!member) throw new ForbiddenException();
    return project;
  }

  async getMemberRole(projectId: string, userId: string): Promise<string> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (project?.userId === userId) return 'owner';
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    return member?.role ?? 'none';
  }

  async delete(id: string, userId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.userId !== userId) throw new ForbiddenException('Only the owner can delete a project');
    await this.prisma.project.delete({ where: { id } });
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
