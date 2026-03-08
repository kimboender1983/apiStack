import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CollectionsService } from '../collections/collections.service';
import { CollectionSchema, FieldSchema, ParsedQuery } from '../../common/types';
import { parseQuery } from './query-parser';

@Injectable()
export class RecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly collections: CollectionsService,
  ) {}

  async list(projectId: string, collectionSlug: string, rawQuery: Record<string, unknown>) {
    const schema = await this.collections.findBySlug(projectId, collectionSlug);
    const query = parseQuery(rawQuery);

    const where = this.buildWhere(projectId, schema.id, query);
    const orderBy = this.buildOrderBy(query);

    const [total, records] = await Promise.all([
      this.prisma.record.count({ where }),
      this.prisma.record.findMany({
        where,
        orderBy,
        take: query.limit,
        skip: query.offset,
      }),
    ]);

    const data = await this.resolveIncludes(records, schema, query.includes, projectId);

    return {
      data,
      meta: {
        total,
        limit: query.limit,
        offset: query.offset,
      },
    };
  }

  async findOne(projectId: string, collectionSlug: string, id: string) {
    const schema = await this.collections.findBySlug(projectId, collectionSlug);

    const record = await this.prisma.record.findFirst({
      where: { id, projectId, collectionId: schema.id },
    });

    if (!record) throw new NotFoundException('Record not found');

    return { id: record.id, ...this.safeData(record.data), createdAt: record.createdAt, updatedAt: record.updatedAt };
  }

  async create(projectId: string, collectionSlug: string, body: Record<string, unknown>) {
    const schema = await this.collections.findBySlug(projectId, collectionSlug);
    const data = this.validateAndCoerce(body, schema);

    const record = await this.prisma.record.create({
      data: { projectId, collectionId: schema.id, data: data as Prisma.InputJsonValue },
    });

    return { id: record.id, ...this.safeData(record.data), createdAt: record.createdAt, updatedAt: record.updatedAt };
  }

  async update(
    projectId: string,
    collectionSlug: string,
    id: string,
    body: Record<string, unknown>,
  ) {
    const schema = await this.collections.findBySlug(projectId, collectionSlug);

    const existing = await this.prisma.record.findFirst({
      where: { id, projectId, collectionId: schema.id },
    });
    if (!existing) throw new NotFoundException('Record not found');

    const merged = { ...(this.safeData(existing.data) as object), ...body };
    const data = this.validateAndCoerce(merged, schema);

    const record = await this.prisma.record.update({
      where: { id },
      data: { data: data as Prisma.InputJsonValue },
    });

    return { id: record.id, ...this.safeData(record.data), createdAt: record.createdAt, updatedAt: record.updatedAt };
  }

  async delete(projectId: string, collectionSlug: string, id: string): Promise<void> {
    const schema = await this.collections.findBySlug(projectId, collectionSlug);
    const existing = await this.prisma.record.findFirst({
      where: { id, projectId, collectionId: schema.id },
    });
    if (!existing) throw new NotFoundException('Record not found');
    await this.prisma.record.delete({ where: { id } });
  }

  private buildWhere(projectId: string, collectionId: string, query: ParsedQuery) {
    const dataFilters: Record<string, unknown>[] = query.filters.map((f) => ({
      data: { path: [f.field], equals: this.coerceFilterValue(f.value) },
    }));

    return {
      projectId,
      collectionId,
      AND: dataFilters,
    };
  }

  private buildOrderBy(query: ParsedQuery): object[] {
    if (query.sort.length === 0) {
      return [{ createdAt: 'desc' }];
    }

    return query.sort.map((s) => {
      if (s.field === 'createdAt' || s.field === 'updatedAt') {
        return { [s.field]: s.dir };
      }
      // For JSONB fields, we use path ordering
      return { data: { path: [s.field], sort: s.dir } };
    });
  }

  private async resolveIncludes(
    records: Array<{ id: string; data: unknown; createdAt: Date; updatedAt: Date }>,
    schema: CollectionSchema,
    includes: string[],
    projectId: string,
  ) {
    if (includes.length === 0) {
      return records.map((r) => ({
        id: r.id,
        ...this.safeData(r.data),
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));
    }

    const result = [];

    for (const record of records) {
      const row: Record<string, unknown> = {
        id: record.id,
        ...this.safeData(record.data),
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      };

      for (const include of includes) {
        const relation = schema.relations.find((r) => r.fieldName === include || r.targetCollectionSlug === include);
        if (!relation) continue;

        const data = row as Record<string, unknown>;
        const rawValue = data[relation.fieldName];

        if (relation.relationType === 'many_to_many' || relation.relationType === 'one_to_many') {
          const ids = Array.isArray(rawValue) ? rawValue as string[] : [];
          if (ids.length > 0) {
            const related = await this.prisma.record.findMany({
              where: {
                projectId,
                collectionId: relation.targetCollectionId,
                id: { in: ids },
              },
            });
            row[relation.targetCollectionSlug] = related.map((r: { id: string; data: unknown }) => ({
              id: r.id,
              ...this.safeData(r.data),
            }));
          } else {
            row[relation.targetCollectionSlug] = [];
          }
        } else {
          // one_to_one
          if (rawValue && typeof rawValue === 'string') {
            const related = await this.prisma.record.findFirst({
              where: {
                projectId,
                collectionId: relation.targetCollectionId,
                id: rawValue,
              },
            });
            row[relation.targetCollectionSlug] = related
              ? { id: related.id, ...this.safeData(related.data) }
              : null;
          }
        }
      }

      result.push(row);
    }

    return result;
  }

  private validateAndCoerce(
    body: Record<string, unknown>,
    schema: CollectionSchema,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const errors: string[] = [];

    for (const field of schema.fields) {
      const raw = body[field.name] ?? this.parseDefaultValue(field);

      if (raw === undefined || raw === null || raw === '') {
        if (field.required) {
          errors.push(`"${field.name}" is required`);
        }
        continue;
      }

      try {
        result[field.name] = this.coerceValue(raw, field);
      } catch (e: any) {
        errors.push(e.message);
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException(errors);
    }

    // Preserve relation references (IDs) — not schema fields
    for (const relation of schema.relations) {
      if (body[relation.fieldName] !== undefined) {
        result[relation.fieldName] = body[relation.fieldName];
      }
    }

    return result;
  }

  private coerceValue(value: unknown, field: FieldSchema): unknown {
    const name = field.name;

    switch (field.type) {
      case 'string':
      case 'text':
      case 'richtext':
        return String(value);

      case 'integer': {
        const n = typeof value === 'number' ? value : parseInt(String(value), 10);
        if (!Number.isFinite(n) || !Number.isInteger(n)) {
          throw new Error(`"${name}" must be an integer (got "${value}")`);
        }
        return n;
      }

      case 'float': {
        const n = typeof value === 'number' ? value : parseFloat(String(value));
        if (!Number.isFinite(n)) {
          throw new Error(`"${name}" must be a number (got "${value}")`);
        }
        return n;
      }

      case 'boolean': {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value !== 0;
        const s = String(value).toLowerCase();
        if (s === 'true') return true;
        if (s === 'false') return false;
        throw new Error(`"${name}" must be a boolean (got "${value}")`);
      }

      case 'date': {
        const d = new Date(value as any);
        if (isNaN(d.getTime())) {
          throw new Error(`"${name}" must be a valid date (got "${value}")`);
        }
        return d.toISOString().slice(0, 10); // YYYY-MM-DD
      }

      case 'datetime': {
        const d = new Date(value as any);
        if (isNaN(d.getTime())) {
          throw new Error(`"${name}" must be a valid datetime (got "${value}")`);
        }
        return d.toISOString();
      }

      case 'json': {
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            if (parsed === null || typeof parsed !== 'object') {
              throw new Error();
            }
            return parsed;
          } catch {
            throw new Error(`"${name}" must be a valid JSON object or array`);
          }
        }
        if (value !== null && typeof value === 'object') return value;
        throw new Error(`"${name}" must be a JSON object or array (got "${typeof value}")`);
      }

      case 'enum': {
        const str = String(value);
        const allowed = (field.enumValues ?? []) as string[];
        if (!allowed.includes(str)) {
          throw new Error(
            `"${name}" must be one of: ${allowed.join(', ')} (got "${str}")`,
          );
        }
        return str;
      }

      case 'file':
        return value; // URL string or file reference — stored as-is
    }
  }

  private coerceFilterValue(value: string): unknown {
    if (value === 'true') return true;
    if (value === 'false') return false;
    const num = Number(value);
    if (!isNaN(num) && value.trim() !== '') return num;
    return value;
  }

  private parseDefaultValue(field: FieldSchema): unknown {
    if (field.defaultValue === null || field.defaultValue === undefined) return undefined;
    return this.coerceFilterValue(field.defaultValue);
  }

  private safeData(data: unknown): Record<string, unknown> {
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }
    return {};
  }
}
