import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RelationType } from '../../common/types';

@Injectable()
export class RelationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    collectionId: string,
    fieldName: string,
    relationType: RelationType,
    targetCollectionId: string,
  ) {
    // Verify both collections exist
    const [source, target] = await Promise.all([
      this.prisma.collection.findUnique({ where: { id: collectionId } }),
      this.prisma.collection.findUnique({ where: { id: targetCollectionId } }),
    ]);

    if (!source) throw new NotFoundException('Source collection not found');
    if (!target) throw new NotFoundException('Target collection not found');

    return this.prisma.relation.create({
      data: { collectionId, fieldName, relationType, targetCollectionId },
    });
  }

  async list(collectionId: string) {
    return this.prisma.relation.findMany({
      where: { collectionId },
      include: { targetCollection: { select: { id: true, slug: true, name: true } } },
    });
  }

  async delete(id: string, collectionId: string): Promise<void> {
    const relation = await this.prisma.relation.findFirst({ where: { id, collectionId } });
    if (!relation) throw new NotFoundException('Relation not found');
    await this.prisma.relation.delete({ where: { id } });
  }
}
