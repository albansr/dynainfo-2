import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { ListService } from './list.service.js';
import { AnalyticsQueryBuilder } from '../../core/db/clickhouse/query/analytics-query-builder.js';
import type { DatabaseClient } from '../../core/db/clickhouse/client.js';
import type { ListQueryParams } from './list.schemas.js';
import {
  ListQueryStringSchema,
  ListResponseSchema,
} from './list.schemas.js';
import { sanitizeDateString, sanitizeFieldName } from '../../core/utils/sanitization.js';
import { parseQueryParamsToFilters } from '../balance/balance.schemas.js';
import { parseDynamicFilters, combineFilters } from '../../core/utils/filter-parser.js';

/**
 * Register list routes
 */
export function listRoutes(
  fastify: FastifyInstance,
  dbClient: DatabaseClient
): void {
  // Use TypeBox type provider for type-safe schemas
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // Instantiate service with DI
  const analyticsBuilder = new AnalyticsQueryBuilder(dbClient.getClient());
  const service = new ListService(analyticsBuilder);

  /**
   * GET /list
   * Get list of balance sheets grouped by dimension
   *
   * Query params:
   * - groupBy: Dimension to group by (seller_id, IdRegional, month, quarter, year) - REQUIRED
   * - startDate: ISO date string (optional)
   * - endDate: ISO date string (optional)
   * - page: Page number (optional, default 1)
   * - limit: Items per page (optional, default 50, min 20, max 100)
   * - Any other params: Dynamic filters (comma-separated for multiple values)
   *
   * Examples:
   * - /list?groupBy=seller_id&country=españa
   * - /list?groupBy=IdRegional&seller_id=S001,S002&page=2
   * - /list?groupBy=month&startDate=2025-01-01&country=españa,portugal
   *
   * Response: Array of items, each with same structure as /balance endpoint
   */
  server.get(
    '/list',
    {
      schema: {
        description: 'Get list of balance sheets grouped by dimension. Supports dynamic filters and pagination.',
        tags: ['list'],
        querystring: ListQueryStringSchema,
        response: {
          200: ListResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const query = request.query;

      // Sanitize and parse query params
      const params: ListQueryParams = {
        groupBy: sanitizeFieldName(query.groupBy) as ListQueryParams['groupBy'],
        ...(query.startDate && { startDate: sanitizeDateString(query.startDate) }),
        ...(query.endDate && { endDate: sanitizeDateString(query.endDate) }),
        ...(query.page && { page: query.page }),
        ...(query.limit && { limit: query.limit }),
        ...(query.orderBy && { orderBy: sanitizeFieldName(query.orderBy) }),
        ...(query.orderDirection && { orderDirection: query.orderDirection }),
      };

      // Parse date filters from startDate/endDate
      const dateFilters = parseQueryParamsToFilters(params);

      // Parse dynamic filters from all other query params
      const dynamicFilters = parseDynamicFilters(query);

      // Combine all filters
      const allFilters = combineFilters(dynamicFilters, dateFilters);

      // Get list with combined filters
      const listResponse = await service.getBalanceList({
        ...params,
        filters: allFilters,
      });

      return reply.code(200).send(listResponse);
    }
  );
}
