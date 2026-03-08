import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ExportImportService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Collection export ──────────────────────────────────────────────────────

  async exportCollectionJson(projectId: string, collectionSlug: string) {
    const collection = await this.getCollection(projectId, collectionSlug);
    const records = await this.prisma.record.findMany({
      where: { projectId, collectionId: collection.id },
      orderBy: { createdAt: 'asc' },
    });

    return {
      collection: collection.slug,
      exportedAt: new Date().toISOString(),
      count: records.length,
      data: records.map((r) => ({
        _id: r.id,
        ...(r.data as object),
        _createdAt: r.createdAt,
        _updatedAt: r.updatedAt,
      })),
    };
  }

  async exportCollectionCsv(projectId: string, collectionSlug: string): Promise<string> {
    const collection = await this.getCollection(projectId, collectionSlug);
    const fields = await this.prisma.field.findMany({
      where: { collectionId: collection.id },
      orderBy: { position: 'asc' },
    });
    const records = await this.prisma.record.findMany({
      where: { projectId, collectionId: collection.id },
      orderBy: { createdAt: 'asc' },
    });

    const columns = ['id', ...fields.map((f) => f.name), 'createdAt', 'updatedAt'];

    const rows = records.map((r) => {
      const data = r.data as Record<string, unknown>;
      return columns.map((col) => {
        let val: unknown;
        if (col === 'id') val = r.id;
        else if (col === 'createdAt') val = r.createdAt.toISOString();
        else if (col === 'updatedAt') val = r.updatedAt.toISOString();
        else val = data[col];

        if (val === null || val === undefined) return '';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
      });
    });

    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = columns.map(escape).join(',');
    const body = rows.map((row) => row.map(escape).join(',')).join('\n');
    return header + '\n' + body;
  }

  // ── Collection import ──────────────────────────────────────────────────────

  async importCollection(
    projectId: string,
    collectionSlug: string,
    content: string,
    filename: string,
  ): Promise<{ imported: number; skipped: number }> {
    const collection = await this.getCollection(projectId, collectionSlug);

    let rows: Record<string, unknown>[];
    if (filename.endsWith('.csv')) {
      rows = this.parseCsv(content);
    } else {
      const parsed = JSON.parse(content);
      rows = Array.isArray(parsed) ? parsed : (parsed.data ?? []);
    }

    let imported = 0;
    let skipped = 0;

    for (const row of rows) {
      try {
        const { _id, id, _createdAt, _updatedAt, createdAt, updatedAt, ...data } =
          row as Record<string, unknown>;
        await this.prisma.record.create({
          data: { projectId, collectionId: collection.id, data: data as any },
        });
        imported++;
      } catch {
        skipped++;
      }
    }

    return { imported, skipped };
  }

  // ── Project export ─────────────────────────────────────────────────────────

  async exportProject(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const collections = await this.prisma.collection.findMany({
      where: { projectId },
      include: {
        fields: { orderBy: { position: 'asc' } },
        relationsFrom: true,
      },
    });

    const collectionMap = new Map(collections.map((c) => [c.id, c.slug]));

    const collectionsData = await Promise.all(
      collections.map(async (col) => {
        const records = await this.prisma.record.findMany({
          where: { projectId, collectionId: col.id },
          orderBy: { createdAt: 'asc' },
        });

        return {
          name: col.name,
          slug: col.slug,
          visibility: col.visibility,
          fields: col.fields.map((f) => ({
            name: f.name,
            type: f.type,
            required: f.required,
            defaultValue: f.defaultValue,
            enumValues: f.enumValues,
            position: f.position,
          })),
          relations: col.relationsFrom.map((r) => ({
            fieldName: r.fieldName,
            relationType: r.relationType,
            targetCollectionSlug: collectionMap.get(r.targetCollectionId) ?? '',
          })),
          records: records.map((r) => ({
            _id: r.id,
            ...(r.data as object),
            _createdAt: r.createdAt,
          })),
        };
      }),
    );

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      project: { name: project.name, slug: project.slug },
      collections: collectionsData,
    };
  }

  // ── Project import ─────────────────────────────────────────────────────────

  async importProject(
    projectId: string,
    content: string,
  ): Promise<{ collections: number; records: number }> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const bundle = JSON.parse(content);
    if (!bundle.collections) throw new BadRequestException('Invalid project bundle');

    // Pass 1: create collections + fields
    for (const colData of bundle.collections) {
      let collection = await this.prisma.collection.findUnique({
        where: { projectId_slug: { projectId, slug: colData.slug } },
      });

      if (!collection) {
        collection = await this.prisma.collection.create({
          data: {
            projectId,
            name: colData.name,
            slug: colData.slug,
            visibility: colData.visibility ?? 'protected',
          },
        });
      }

      for (const fieldData of colData.fields ?? []) {
        const exists = await this.prisma.field.findUnique({
          where: { collectionId_name: { collectionId: collection.id, name: fieldData.name } },
        });
        if (!exists) {
          await this.prisma.field.create({
            data: {
              collectionId: collection.id,
              name: fieldData.name,
              type: fieldData.type,
              required: fieldData.required ?? false,
              defaultValue: fieldData.defaultValue,
              enumValues: fieldData.enumValues,
              position: fieldData.position ?? 0,
            },
          });
        }
      }
    }

    // Pass 2: create relations (all collections must exist first)
    for (const colData of bundle.collections) {
      const collection = await this.prisma.collection.findUnique({
        where: { projectId_slug: { projectId, slug: colData.slug } },
      });
      if (!collection) continue;

      for (const relData of colData.relations ?? []) {
        const targetCollection = await this.prisma.collection.findUnique({
          where: { projectId_slug: { projectId, slug: relData.targetCollectionSlug } },
        });
        if (!targetCollection) continue;

        const exists = await this.prisma.relation.findFirst({
          where: { collectionId: collection.id, fieldName: relData.fieldName },
        });
        if (!exists) {
          await this.prisma.relation.create({
            data: {
              collectionId: collection.id,
              fieldName: relData.fieldName,
              relationType: relData.relationType,
              targetCollectionId: targetCollection.id,
            },
          });
        }
      }
    }

    // Pass 3: insert records, build old→new ID map
    const idMap = new Map<string, string>();
    let totalRecords = 0;

    for (const colData of bundle.collections) {
      const collection = await this.prisma.collection.findUnique({
        where: { projectId_slug: { projectId, slug: colData.slug } },
      });
      if (!collection) continue;

      for (const recordData of colData.records ?? []) {
        const { _id, _createdAt, ...data } = recordData as Record<string, unknown>;
        const record = await this.prisma.record.create({
          data: { projectId, collectionId: collection.id, data: data as any },
        });
        if (_id) idMap.set(_id as string, record.id);
        totalRecords++;
      }
    }

    // Pass 4: remap relation IDs in inserted records
    if (idMap.size > 0) {
      for (const colData of bundle.collections) {
        if (!colData.relations?.length) continue;

        const collection = await this.prisma.collection.findUnique({
          where: { projectId_slug: { projectId, slug: colData.slug } },
        });
        if (!collection) continue;

        const records = await this.prisma.record.findMany({
          where: { projectId, collectionId: collection.id },
        });

        for (const record of records) {
          const data = { ...(record.data as Record<string, unknown>) };
          let changed = false;

          for (const relData of colData.relations) {
            const val = data[relData.fieldName];
            if (Array.isArray(val)) {
              const remapped = (val as string[]).map((id) => idMap.get(id) ?? id);
              if (remapped.some((v, i) => v !== val[i])) {
                data[relData.fieldName] = remapped;
                changed = true;
              }
            } else if (typeof val === 'string' && idMap.has(val)) {
              data[relData.fieldName] = idMap.get(val);
              changed = true;
            }
          }

          if (changed) {
            await this.prisma.record.update({ where: { id: record.id }, data: { data: data as any } });
          }
        }
      }
    }

    return { collections: bundle.collections.length, records: totalRecords };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async getCollection(projectId: string, slug: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { projectId_slug: { projectId, slug } },
    });
    if (!collection) throw new NotFoundException('Collection not found');
    return collection;
  }

  private parseCsv(content: string): Record<string, unknown>[] {
    const lines = content.split('\n').filter((l) => l.trim());
    if (lines.length < 2) return [];
    const headers = this.parseCsvRow(lines[0]);
    return lines.slice(1).map((line) => {
      const values = this.parseCsvRow(line);
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => { obj[h] = values[i] ?? ''; });
      return obj;
    });
  }

  private parseCsvRow(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current); current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }
}
