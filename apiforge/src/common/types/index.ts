export type FieldType = 'string' | 'text' | 'richtext' | 'integer' | 'float' | 'boolean' | 'date' | 'datetime' | 'json' | 'enum' | 'file';

export type RelationType = 'one_to_one' | 'one_to_many' | 'many_to_many';

export type CollectionVisibility = 'public' | 'protected' | 'private';

export type ApiKeyPermission = 'read' | 'write' | 'admin';

export interface ResolvedApiKey {
  id: string;
  projectId: string;
  permissions: ApiKeyPermission;
  rateLimitPerMinute: number;
  rateLimitPerHour: number;
}

export interface QueryFilter {
  field: string;
  value: string;
}

export interface QuerySort {
  field: string;
  dir: 'asc' | 'desc';
}

export interface ParsedQuery {
  filters: QueryFilter[];
  sort: QuerySort[];
  limit: number;
  offset: number;
  includes: string[];
}

export interface FieldSchema {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  defaultValue: string | null;
  enumValues: string[] | null;
}

export interface RelationSchema {
  id: string;
  fieldName: string;
  relationType: RelationType;
  targetCollectionId: string;
  targetCollectionSlug: string;
}

export interface CollectionSchema {
  id: string;
  slug: string;
  visibility: CollectionVisibility;
  fields: FieldSchema[];
  relations: RelationSchema[];
}
