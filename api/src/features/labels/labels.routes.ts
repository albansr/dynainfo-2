import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { LabelsService } from './labels.service.js';
import { AnalyticsQueryBuilder } from '../../core/db/clickhouse/query/analytics-query-builder.js';
import type { DatabaseClient } from '../../core/db/clickhouse/client.js';
import {
  LabelsQuerySchema,
  LabelsDataSchema,
} from './labels.schemas.js';
import { SuccessResponseSchema } from '../../core/schemas/common.schemas.js';

/**
 * Register labels routes
 */
export function labelsRoutes(
  fastify: FastifyInstance,
  dbClient: DatabaseClient
): void {
  // Use TypeBox type provider for type-safe schemas
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // Instantiate service with DI
  const analyticsBuilder = new AnalyticsQueryBuilder(dbClient.getClient());
  const service = new LabelsService(analyticsBuilder);

  /**
   * GET /labels
   * Get distinct values from a specified column
   *
   * Query params:
   * - column: Column name to get distinct values from (required)
   * - startDate: ISO date string (optional)
   * - endDate: ISO date string (optional)
   *
   * Examples:
   * - /labels?column=brand
   * - /labels?column=category&startDate=2024-01-01&endDate=2024-12-31
   */
  server.get(
    '/labels',
    {
      schema: {
        description: 'Get distinct values from a column, sorted alphabetically A-Z',
        tags: ['labels'],
        querystring: LabelsQuerySchema,
        response: {
          200: SuccessResponseSchema(LabelsDataSchema),
        },
      },
    },
    async (request, reply) => {
      const labels = await service.getLabels(request.query);

      // labels = {data: string[]}
      // We want to send {data: string[]} to match SuccessResponseSchema(LabelsDataSchema)
      return reply.code(200).send({
        data: labels.data,
      });
    }
  );
}
