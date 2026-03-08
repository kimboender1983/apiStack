import { Injectable } from '@nestjs/common';
import { Readable } from 'stream';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../uploads/storage.service';

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async upload(stream: Readable, originalName: string, mimeType: string, projectId: string | null) {
    const stored = await this.storage.save(stream, originalName, mimeType, projectId ?? 'global');
    return this.prisma.file.create({
      data: {
        projectId: projectId ?? null,
        url: stored.url,
        filename: stored.filename,
        originalName: stored.originalName,
        size: stored.size,
        mimeType: stored.mimeType,
        name: stored.originalName,
      },
    });
  }

  update(id: string, data: {
    name?: string;
    title?: string;
    alt?: string;
    copyright?: string;
    focus?: string;
    metaData?: Record<string, unknown>;
  }) {
    const { metaData, ...rest } = data;
    return this.prisma.file.update({
      where: { id },
      data: {
        ...rest,
        ...(metaData !== undefined ? { metaData: metaData as Prisma.InputJsonValue } : {}),
      },
    });
  }

  listGlobal() {
    return this.prisma.file.findMany({
      where: { projectId: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  listForProject(projectId: string) {
    return this.prisma.file.findMany({
      where: { OR: [{ projectId }, { projectId: null }] },
      orderBy: { createdAt: 'desc' },
    });
  }

  async delete(id: string) {
    await this.prisma.file.delete({ where: { id } });
  }
}
