import { Type, type TSchema } from '@sinclair/typebox';

/**
 * Common TypeBox schemas shared across all endpoints
 * For feature-specific schemas, see respective feature folders
 */

/**
 * Date string schema (ISO 8601 format)
 */
export const DateStringSchema = Type.String({
  format: 'date',
  pattern: '^\\d{4}-\\d{2}-\\d{2}$',
  description: 'Date in YYYY-MM-DD format',
});

/**
 * API success response wrapper
 */
export const SuccessResponseSchema = <T extends TSchema>(dataSchema: T) =>
  Type.Object({
    data: dataSchema,
  });

/**
 * Error response schema
 */
export const ErrorResponseSchema = Type.Object({
  error: Type.Object({
    code: Type.String({ description: 'Error code' }),
    message: Type.String({ description: 'Error message' }),
    details: Type.Optional(Type.Unknown({ description: 'Additional error details' })),
  }),
});

/**
 * Health check response schema
 */
export const HealthCheckResponseSchema = Type.Object({
  status: Type.Union([Type.Literal('healthy'), Type.Literal('unhealthy')]),
  timestamp: Type.String({ format: 'date-time' }),
  uptime: Type.Optional(Type.Number()),
  responseTime: Type.Optional(Type.String()),
  database: Type.Optional(
    Type.Union([
      Type.Object({
        connected: Type.Boolean(),
        responseTime: Type.String(),
      }),
      Type.Literal('disconnected'),
    ])
  ),
  memory: Type.Optional(
    Type.Object({
      heapUsed: Type.String(),
      heapTotal: Type.String(),
      rss: Type.String(),
    })
  ),
});

/**
 * API info response schema
 */
export const ApiInfoResponseSchema = Type.Object({
  name: Type.String(),
  version: Type.String(),
  description: Type.String(),
  endpoints: Type.Object({
    health: Type.String(),
    balance: Type.String(),
    list: Type.String(),
    labels: Type.String(),
  }),
});
