import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { ListService } from './list.service.js';
import { AnalyticsQueryBuilder } from '../../core/db/clickhouse/query/analytics-query-builder.js';
import type { DatabaseClient } from '../../core/db/clickhouse/client.js';
import type { ListQueryParams } from './list.schemas.js';
import {
  ListQueryStringSchema,
  ListResponseSchema,
  SellerStatusSchema,
} from './list.schemas.js';
import { BalanceQueryStringSchema } from '../balance/balance.schemas.js';
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
        ...(query.orderDirection ? { orderDirection: query.orderDirection } : {}),
        ...(query.customerPreset ? { customerPreset: query.customerPreset } : {}),
      };

      // Parse date filters from startDate/endDate
      const dateFilters = parseQueryParamsToFilters(params);

      // Parse dynamic filters from all other query params
      const dynamicFilters = parseDynamicFilters(query);

      // Combine all filters
      const allFilters = combineFilters(dynamicFilters, dateFilters);

      // Closed periods (facturadoOnly) exclude comprometido from budget-relative metrics
      const facturadoOnly = (query as Record<string, unknown>)['facturadoOnly'] === true
        || (query as Record<string, unknown>)['facturadoOnly'] === 'true';

      // Optional case-insensitive search on the dimension id/name
      const search = typeof (query as Record<string, unknown>)['search'] === 'string'
        ? ((query as Record<string, unknown>)['search'] as string)
        : undefined;

      // Get list with combined filters
      const listResponse = await service.getBalanceList({
        ...params,
        filters: allFilters,
        facturadoOnly,
        ...(search && { search }),
      });

      // Fastify's schema-inferred serializer type diverges from the TypeBox
      // Static response type, so the payload needs a cast here.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return reply.code(200).send(listResponse as any);
    }
  );

  /**
   * GET /list/seller-status
   * Headline counts for the seller "Estado" page (one per insight card), scoped
   * to the seller and window via dynamic filters (e.g. seller_id, startDate/endDate).
   */
  server.get(
    '/list/seller-status',
    {
      schema: {
        description: 'Seller Estado headline counts (numérica, sin compra, riesgo, promesa, peso).',
        tags: ['list'],
        querystring: BalanceQueryStringSchema,
        response: {
          200: SellerStatusSchema,
        },
      },
    },
    async (request, reply) => {
      const query = request.query as Record<string, unknown>;
      const params = {
        ...(typeof query['startDate'] === 'string' && { startDate: sanitizeDateString(query['startDate']) }),
        ...(typeof query['endDate'] === 'string' && { endDate: sanitizeDateString(query['endDate']) }),
      } as ListQueryParams;

      // The Estado windows are fixed per criterion in the service; only the seller
      // scope (and any non-date filter) is passed through.
      const dateFilters = parseQueryParamsToFilters(params);
      const dynamicFilters = parseDynamicFilters(query);
      const allFilters = combineFilters(dynamicFilters, dateFilters);

      const status = await service.getSellerStatus({ ...params, filters: allFilters });

      return reply.code(200).send(status);
    }
  );
}
