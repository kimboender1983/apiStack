import { ParsedQuery, QueryFilter, QuerySort } from '../../common/types';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Parses query string parameters into a structured QueryPlan.
 *
 * Supported formats:
 *   filter[field]=value
 *   sort=-createdAt,title     (prefix - = descending)
 *   limit=20
 *   offset=0
 *   include=author,comments
 */
export function parseQuery(query: Record<string, unknown>): ParsedQuery {
  const filters = parseFilters(query);
  const sort = parseSort(query);
  const limit = parseLimit(query);
  const offset = parseOffset(query);
  const includes = parseIncludes(query);

  return { filters, sort, limit, offset, includes };
}

function parseFilters(query: Record<string, unknown>): QueryFilter[] {
  const filters: QueryFilter[] = [];
  const filterParam = query['filter'];

  if (filterParam && typeof filterParam === 'object' && !Array.isArray(filterParam)) {
    for (const [field, value] of Object.entries(filterParam as Record<string, string>)) {
      if (typeof value === 'string' && isSafeIdentifier(field)) {
        filters.push({ field, value });
      }
    }
  }

  return filters;
}

function parseSort(query: Record<string, unknown>): QuerySort[] {
  const sortParam = query['sort'];
  if (!sortParam || typeof sortParam !== 'string') return [];

  return sortParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const dir = s.startsWith('-') ? 'desc' : 'asc';
      const field = s.startsWith('-') || s.startsWith('+') ? s.slice(1) : s;
      if (!isSafeIdentifier(field)) return null;
      return { field, dir } as QuerySort;
    })
    .filter((s): s is QuerySort => s !== null);
}

function parseLimit(query: Record<string, unknown>): number {
  const raw = parseInt(String(query['limit'] ?? DEFAULT_LIMIT), 10);
  if (isNaN(raw) || raw < 1) return DEFAULT_LIMIT;
  return Math.min(raw, MAX_LIMIT);
}

function parseOffset(query: Record<string, unknown>): number {
  const raw = parseInt(String(query['offset'] ?? 0), 10);
  if (isNaN(raw) || raw < 0) return 0;
  return raw;
}

function parseIncludes(query: Record<string, unknown>): string[] {
  const raw = query['include'];
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => isSafeIdentifier(s));
}

/** Allow only alphanumeric + underscore identifiers to prevent injection */
function isSafeIdentifier(value: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value);
}
