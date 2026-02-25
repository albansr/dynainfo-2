import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { BalanceService } from './balance.service.js';
import { AnalyticsQueryBuilder } from '../../core/db/clickhouse/query/analytics-query-builder.js';
import type { DatabaseClient } from '../../core/db/clickhouse/client.js';
import type { BalanceQueryParams } from './balance.schemas.js';
import {
  BalanceQueryStringSchema,
  BalanceSheetResponseSchema,
  parseQueryParamsToFilters,
} from './balance.schemas.js';
import { SuccessResponseSchema } from '../../core/schemas/common.schemas.js';
import { parseDynamicFilters, combineFilters } from '../../core/utils/filter-parser.js';

/**
 * Register balance routes
 */
export function balanceRoutes(
  fastify: FastifyInstance,
  dbClient: DatabaseClient
): void {
  // Use TypeBox type provider for type-safe schemas
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // Instantiate service with DI
  const analyticsBuilder = new AnalyticsQueryBuilder(dbClient.getClient());
  const service = new BalanceService(analyticsBuilder);

  /**
   * GET /balance
   * Get balance sheet with sales, budget, orders
   *
   * Query params:
   * - startDate: ISO date string (optional)
   * - endDate: ISO date string (optional)
   * - Any other params: Dynamic filters (comma-separated for multiple values)
   *
   * Examples:
   * - /balance?seller_id=S001
   * - /balance?seller_id=S001,S002,S003&country=españa
   * - /balance?startDate=2025-01-01&country=españa,portugal
   */
  server.get(
    '/balance',
    {
      schema: {
        description: 'Get balance sheet with sales, budget, and orders data. Supports dynamic filters.',
        tags: ['balance'],
        querystring: BalanceQueryStringSchema,
        response: {
          200: SuccessResponseSchema(BalanceSheetResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const query = request.query;

      // Parse date filters from startDate/endDate
      const params: BalanceQueryParams = {
        ...(query.startDate && { startDate: query.startDate }),
        ...(query.endDate && { endDate: query.endDate }),
      };
      const dateFilters = parseQueryParamsToFilters(params);

      // Parse dynamic filters from all other query params
      const dynamicFilters = parseDynamicFilters(query);

      // Combine all filters
      const allFilters = combineFilters(dynamicFilters, dateFilters);

      // Get balance with combined filters
      const balance = await service.getBalanceSheet({ filters: allFilters });

      return reply.code(200).send({
        data: balance,
      });
    }
  );
}
