import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../prisma/prisma.service';

const VALID_ROLES = ['editor', 'viewer'];
const INVITE_TTL_DAYS = 7;

@Injectable()
export class MembersService {
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: config.get<string>('SMTP_HOST'),
      port: config.get<number>('SMTP_PORT', 587),
      auth: {
        user: config.get<string>('SMTP_USER'),
        pass: config.get<string>('SMTP_PASS'),
      },
    });
  }

  async list(projectId: string) {
    const [members, invitations] = await Promise.all([
      this.prisma.projectMember.findMany({
        where: { projectId },
        include: { user: { select: { id: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.invitation.findMany({
        where: { projectId, acceptedAt: null },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { members, invitations };
  }

  async invite(projectId: string, email: string, role: string) {
    if (!VALID_ROLES.includes(role)) {
      throw new BadRequestException(`Invalid role: ${role}`);
    }

    // Check if user already a member
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingMember = await this.prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: existingUser.id } },
      });
      if (existingMember) {
        throw new ConflictException('User is already a member of this project');
      }
    }

    // Upsert invitation (re-invite resets token + expiry)
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

    // Delete any existing invitation for this email+project (pending or already accepted)
    await this.prisma.invitation.deleteMany({
      where: { projectId, email },
    });

    const invitation = await this.prisma.invitation.create({
      data: { projectId, email, role, expiresAt },
      include: { project: { select: { name: true } } },
    });

    const adminUrl = this.config.get<string>('ADMIN_URL', 'http://localhost:5173');
    const acceptUrl = `${adminUrl}/invitations/accept?token=${invitation.token}`;

    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `\n  Invitation for ${email} to join "${(invitation as any).project.name}" as ${role}:\n  \x1b[33m${acceptUrl}\x1b[0m\n`,
      );
    } else {
      await this.transporter.sendMail({
        from: this.config.get<string>('SMTP_FROM', 'noreply@apiforge.dev'),
        to: email,
        subject: `You've been invited to join ${(invitation as any).project.name}`,
        text: `You've been invited to join "${(invitation as any).project.name}" as ${role}.\n\nAccept the invitation: ${acceptUrl}\n\nThis link expires in ${INVITE_TTL_DAYS} days.`,
        html: `<p>You've been invited to join <strong>${(invitation as any).project.name}</strong> as <strong>${role}</strong>.</p><p><a href="${acceptUrl}">Accept invitation</a></p><p>This link expires in ${INVITE_TTL_DAYS} days.</p>`,
      });
    }

    return invitation;
  }

  async updateRole(projectId: string, memberId: string, role: string) {
    if (!VALID_ROLES.includes(role)) {
      throw new BadRequestException(`Invalid role: ${role}`);
    }
    const member = await this.prisma.projectMember.findFirst({
      where: { id: memberId, projectId },
    });
    if (!member) throw new NotFoundException('Member not found');
    return this.prisma.projectMember.update({
      where: { id: memberId },
      data: { role },
      include: { user: { select: { id: true, email: true } } },
    });
  }

  async removeMember(projectId: string, memberId: string) {
    const member = await this.prisma.projectMember.findFirst({
      where: { id: memberId, projectId },
    });
    if (!member) throw new NotFoundException('Member not found');
    await this.prisma.projectMember.delete({ where: { id: memberId } });
  }

  async cancelInvitation(projectId: string, invitationId: string) {
    const inv = await this.prisma.invitation.findFirst({
      where: { id: invitationId, projectId, acceptedAt: null },
    });
    if (!inv) throw new NotFoundException('Invitation not found');
    await this.prisma.invitation.delete({ where: { id: invitationId } });
  }

  async getInvitation(token: string) {
    const inv = await this.prisma.invitation.findUnique({
      where: { token },
      include: { project: { select: { id: true, name: true } } },
    });
    if (!inv) throw new NotFoundException('Invitation not found or expired');
    if (inv.acceptedAt) throw new BadRequestException('Invitation already accepted');
    if (new Date() > inv.expiresAt) throw new BadRequestException('Invitation has expired');
    return inv;
  }

  async acceptInvitation(token: string, userId: string) {
    const inv = await this.getInvitation(token);

    // Upsert member (handles edge case of duplicate accept)
    await this.prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: inv.projectId, userId } },
      create: { projectId: inv.projectId, userId, role: inv.role },
      update: { role: inv.role },
    });

    await this.prisma.invitation.update({
      where: { id: inv.id },
      data: { acceptedAt: new Date() },
    });

    return { projectId: inv.projectId };
  }
}
