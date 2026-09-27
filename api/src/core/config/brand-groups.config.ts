import type { FilterCondition } from '../db/clickhouse/query/filter-builder.js';

/**
 * Virtual "Marcas" grouping: two aggregated buckets by commercial provider
 * membership, mirroring the Festival Virtual listing and the Marcas
 * Exclusivas / Aliadas dashboards.
 *
 * `brand_group` is NOT a ClickHouse column — it is a UI bucket. The list feature
 * intercepts it before the query builder: when grouping by it, each bucket is
 * computed with the same provider filter the Marcas dashboards use (so a bucket
 * total matches its dashboard); when it appears as a drill filter, it is expanded
 * into the real provider conditions.
 */
export const BRAND_GROUP = 'brand_group';

/** Providers considered "exclusive" brands (same definition as the dashboards). */
export const EXCLUSIVE_BRANDS = ['VERA', 'FORTE'];

export type BrandBucketId = 'exclusivas' | 'aliadas';

export interface BrandBucket {
  /** Machine id used in drill filters (`brand_group=<id>`). */
  id: BrandBucketId;
  /** Display name / row label. */
  name: string;
}

export const BRAND_BUCKETS: readonly BrandBucket[] = [
  { id: 'exclusivas', name: 'Marcas Exclusivas' },
  { id: 'aliadas', name: 'Marcas Aliadas' },
];

/**
 * Provider filter for a brand bucket — the same definition the Marcas dashboards
 * use (ProveedorComercial IN / NOT IN EXCLUSIVE_BRANDS). The filter-builder is
 * table-aware and applies it to every metric table that carries the provider
 * column, exactly as those dashboards do.
 */
export function brandGroupFilters(bucket: BrandBucketId): FilterCondition[] {
  return bucket === 'exclusivas'
    ? [{ field: 'ProveedorComercial', operator: 'in', value: EXCLUSIVE_BRANDS }]
    : EXCLUSIVE_BRANDS.map((brand) => ({
        field: 'ProveedorComercial',
        operator: 'neq' as const,
        value: brand,
      }));
}

/**
 * Expand any `brand_group` drill filter (value 'exclusivas' | 'aliadas') into the
 * real provider conditions, dropping the virtual condition. A no-op when no
 * `brand_group` filter is present. Used when a bucket is drilled into so the
 * downstream grouping (by provider, product…) is scoped to that bucket.
 */
export function expandBrandGroupFilters(filters: FilterCondition[]): FilterCondition[] {
  return filters.flatMap((f) => {
    if (f.field !== BRAND_GROUP) return [f];
    return f.value === 'exclusivas' || f.value === 'aliadas'
      ? brandGroupFilters(f.value)
      : [];
  });
}
