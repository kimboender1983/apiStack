import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { AuthUser } from '../../common/decorators/project.decorator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../uploads/storage.service';

const USER_SELECT = { id: true, email: true, name: true, avatarUrl: true, createdAt: true };

class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}

@Controller('admin/me')
@UseGuards(JwtGuard)
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  me(@AuthUser() user: { id: string }) {
    return this.prisma.user.findUnique({ where: { id: user.id }, select: USER_SELECT });
  }

  @Patch()
  updateMe(@AuthUser() user: { id: string }, @Body() dto: UpdateMeDto) {
    return this.prisma.user.update({
      where: { id: user.id },
      data: { name: dto.name },
      select: USER_SELECT,
    });
  }

  @Post('avatar')
  async uploadAvatar(@AuthUser() user: { id: string }, @Req() req: any) {
    if (!req.isMultipart()) throw new BadRequestException('Request must be multipart/form-data');
    const file = await req.file({ limits: { fileSize: 5 * 1024 * 1024 } }); // 5 MB max
    if (!file) throw new BadRequestException('No file provided');
    if (!file.mimetype.startsWith('image/')) throw new BadRequestException('File must be an image');

    const stored = await this.storage.save(file.file, file.filename, file.mimetype, `avatars/${user.id}`);
    return this.prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl: stored.url },
      select: USER_SELECT,
    });
  }
}
