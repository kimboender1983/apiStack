import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CollectionVisibility, CollectionSchema, FieldType, RelationType } from '../../common/types';

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    projectId: string,
    name: string,
    visibility: CollectionVisibility = 'protected',
  ) {
    const slug = this.slugify(name);

    const existing = await this.prisma.collection.findUnique({
      where: { projectId_slug: { projectId, slug } },
    });
    if (existing) {
      throw new ConflictException(`Collection "${slug}" already exists in this project`);
    }

    return this.prisma.collection.create({
      data: { projectId, name, slug, visibility },
    });
  }

  async list(projectId: string) {
    return this.prisma.collection.findMany({
      where: { projectId },
      include: { fields: true },
    });
  }

  async findBySlug(projectId: string, slug: string): Promise<CollectionSchema> {
    const collection = await this.prisma.collection.findUnique({
      where: { projectId_slug: { projectId, slug } },
      include: {
        fields: true,
        relationsFrom: {
          include: { targetCollection: true },
        },
      },
    });

    if (!collection) {
      throw new NotFoundException(`Collection "${slug}" not found`);
    }

    return {
      id: collection.id,
      slug: collection.slug,
      visibility: collection.visibility as CollectionVisibility,
      fields: collection.fields.map((f: { id: string; name: string; type: string; required: boolean; defaultValue: string | null; enumValues: unknown }) => ({
        id: f.id,
        name: f.name,
        type: f.type as FieldType,
        required: f.required,
        defaultValue: f.defaultValue,
        enumValues: Array.isArray(f.enumValues) ? f.enumValues as string[] : null,
      })),
      relations: collection.relationsFrom.map((r: { id: string; fieldName: string; relationType: string; targetCollectionId: string; targetCollection: { slug: string } }) => ({
        id: r.id,
        fieldName: r.fieldName,
        relationType: r.relationType as RelationType,
        targetCollectionId: r.targetCollectionId,
        targetCollectionSlug: r.targetCollection.slug,
      })),
    };
  }

  async delete(projectId: string, id: string): Promise<void> {
    const collection = await this.prisma.collection.findFirst({
      where: { id, projectId },
    });
    if (!collection) throw new NotFoundException('Collection not found');
    await this.prisma.collection.delete({ where: { id } });
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  }
}
