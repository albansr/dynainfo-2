import { Type, type Static } from '@sinclair/typebox';

/**
 * Labels Query Parameters Schema
 * Accepts column name (required) and optional date range filters + pagination
 */
export const LabelsQuerySchema = Type.Object({
  column: Type.String({
    description: 'Column name to get distinct values from',
    examples: ['brand', 'category', 'region'],
  }),
  startDate: Type.Optional(
    Type.String({
      format: 'date',
      description: 'Start date for filtering (YYYY-MM-DD)',
      examples: ['2024-01-01'],
    })
  ),
  endDate: Type.Optional(
    Type.String({
      format: 'date',
      description: 'End date for filtering (YYYY-MM-DD)',
      examples: ['2024-12-31'],
    })
  ),
  limit: Type.Optional(
    Type.Integer({
      minimum: 1,
      maximum: 1000,
      default: 100,
      description: 'Maximum number of results to return',
      examples: [100, 500],
    })
  ),
  offset: Type.Optional(
    Type.Integer({
      minimum: 0,
      default: 0,
      description: 'Number of results to skip',
      examples: [0, 100, 200],
    })
  ),
});

export type LabelsQueryParams = Static<typeof LabelsQuerySchema>;

/**
 * Labels Data Schema (just the array)
 * Used for wrapping in SuccessResponseSchema
 */
export const LabelsDataSchema = Type.Array(Type.String(), {
  description: 'Array of unique column values sorted A-Z',
});

/**
 * Labels Response Schema
 * Returns array of distinct values sorted alphabetically
 */
export const LabelsResponseSchema = Type.Object({
  data: LabelsDataSchema,
});

export type LabelsResponse = Static<typeof LabelsResponseSchema>;
