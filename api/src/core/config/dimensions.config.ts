/**
 * Configuration for allowed groupBy dimensions
 *
 * To add a new dimension:
 * 1. Add it to the ALLOWED_DIMENSIONS array
 * 2. Ensure the field exists in your ClickHouse tables
 * 3. The schema and validation will be generated automatically
 */

export const ALLOWED_DIMENSIONS = [
  'seller_id',
  'IdRegional',
  'month',
  'quarter',
  'year',
] as const;

export type GroupByDimension = typeof ALLOWED_DIMENSIONS[number];
