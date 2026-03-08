import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FieldType } from '../../common/types';

const VALID_TYPES: string[] = [
  'string', 'text', 'richtext', 'integer', 'float', 'boolean', 'date', 'datetime', 'json', 'enum', 'file',
];

interface FieldPayload {
  name: string;
  type: FieldType | 'enum';
  required?: boolean;
  defaultValue?: string;
  enumValues?: string[];
}

@Injectable()
export class FieldsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(collectionId: string, payload: FieldPayload) {
    if (!VALID_TYPES.includes(payload.type)) {
      throw new BadRequestException(`Invalid field type: ${payload.type}`);
    }
    if (payload.type === 'enum' && (!payload.enumValues || payload.enumValues.length === 0)) {
      throw new BadRequestException('Enum fields require at least one value');
    }

    const existing = await this.prisma.field.findUnique({
      where: { collectionId_name: { collectionId, name: payload.name } },
    });
    if (existing) throw new ConflictException(`Field "${payload.name}" already exists`);

    const count = await this.prisma.field.count({ where: { collectionId } });

    return this.prisma.field.create({
      data: {
        collectionId,
        name: payload.name,
        type: payload.type,
        required: payload.required ?? false,
        defaultValue: payload.defaultValue,
        enumValues: payload.type === 'enum' ? payload.enumValues : undefined,
        position: count,
      },
    });
  }

  async update(id: string, collectionId: string, payload: Partial<FieldPayload>) {
    const field = await this.prisma.field.findFirst({ where: { id, collectionId } });
    if (!field) throw new NotFoundException('Field not found');

    const type = payload.type ?? field.type;
    if (payload.type && !VALID_TYPES.includes(payload.type)) {
      throw new BadRequestException(`Invalid field type: ${payload.type}`);
    }
    if (type === 'enum') {
      const values = payload.enumValues ?? (field.enumValues as string[] | null);
      if (!values || values.length === 0) {
        throw new BadRequestException('Enum fields require at least one value');
      }
    }

    return this.prisma.field.update({
      where: { id },
      data: {
        name: payload.name,
        type: payload.type,
        required: payload.required,
        defaultValue: payload.defaultValue,
        enumValues: type === 'enum'
          ? (payload.enumValues ?? (field.enumValues as string[]))
          : Prisma.JsonNull,
      },
    });
  }

  async list(collectionId: string) {
    return this.prisma.field.findMany({
      where: { collectionId },
      orderBy: { position: 'asc' },
    });
  }

  async reorder(collectionId: string, ids: string[]): Promise<void> {
    await this.prisma.$transaction(
      ids.map((id, position) =>
        this.prisma.field.updateMany({
          where: { id, collectionId },
          data: { position },
        }),
      ),
    );
  }

  async delete(id: string, collectionId: string): Promise<void> {
    const field = await this.prisma.field.findFirst({ where: { id, collectionId } });
    if (!field) throw new NotFoundException('Field not found');
    await this.prisma.field.delete({ where: { id } });
  }
}
