import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { BalanceService, historyWindow, type ReachWindows } from './balance.service.js';
import { AnalyticsQueryBuilder } from '../../core/db/clickhouse/query/analytics-query-builder.js';
import type { DatabaseClient } from '../../core/db/clickhouse/client.js';
import type { BalanceQueryParams } from './balance.schemas.js';
import {
  BalanceQueryStringSchema,
  BalanceSheetResponseSchema,
  BalanceReachQueryStringSchema,
  BalanceReachSchema,
  BalanceSinCompraExportQueryStringSchema,
  parseQueryParamsToFilters,
  parseBooleanParam,
} from './balance.schemas.js';
import { FestivalSinCompraSchema } from '../festival/festival.schemas.js';
import { buildSinCompraExportWorkbook } from '../festival/festival.export.workbook.js';
import { sendXlsx } from '../../core/utils/export-filename.js';
import { SuccessResponseSchema, DateStringSchema } from '../../core/schemas/common.schemas.js';
import { parseDynamicFilters, combineFilters } from '../../core/utils/filter-parser.js';


/**
 * Reach windows from a query: the selected period and the 12 months before it,
 * both with the same dashboard filters (channel, provider, role scope…).
 */
function buildReachWindows(query: { startDate: string; endDate: string } & Record<string, unknown>): ReachWindows {
  const dynamicFilters = parseDynamicFilters(query);
  return {
    periodFilters: combineFilters(
      dynamicFilters,
      parseQueryParamsToFilters({ startDate: query.startDate, endDate: query.endDate })
    ),
    historyFilters: combineFilters(dynamicFilters, parseQueryParamsToFilters(historyWindow(query.startDate))),
    facturadoOnly: parseBooleanParam(query, 'facturadoOnly'),
  };
}

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

      // Closed periods (facturadoOnly) exclude comprometido from budget-relative metrics
      const facturadoOnly = parseBooleanParam(query, 'facturadoOnly');

      // Get balance with combined filters
      // Opt-in: product listings ask for units/cost for their totals row
      const includeUnits = parseBooleanParam(query, 'includeUnits');
      const balance = await service.getBalanceSheet({ filters: allFilters, facturadoOnly, includeUnits });

      return reply.code(200).send({
        data: balance,
      });
    }
  );

  /**
   * GET /balance/series
   * Get time-series sales data grouped by day or month
   *
   * Query params:
   * - startDate: ISO date string (optional)
   * - endDate: ISO date string (optional)
   * - granularity: 'day' | 'month' (default: 'day')
   * - Any other params: Dynamic filters (comma-separated for multiple values)
   */
  server.get(
    '/balance/series',
    {
      schema: {
        description: 'Get time-series sales data grouped by day or month.',
        tags: ['balance'],
        querystring: Type.Object(
          {
            startDate: Type.Optional(DateStringSchema),
            endDate: Type.Optional(DateStringSchema),
            granularity: Type.Optional(Type.Union([Type.Literal('day'), Type.Literal('month')])),
          },
          { additionalProperties: true }
        ),
        response: {
          200: SuccessResponseSchema(
            Type.Array(
              Type.Object({
                period: Type.String(),
                sales: Type.Number(),
                budget: Type.Number(),
              })
            )
          ),
        },
      },
    },
    async (request, reply) => {
      const query = request.query as Record<string, unknown>;
      const granularity = (query['granularity'] as 'day' | 'month') ?? 'day';

      const params: BalanceQueryParams = {};
      if (query['startDate']) params.startDate = String(query['startDate']);
      if (query['endDate']) params.endDate = String(query['endDate']);
      const dateFilters = parseQueryParamsToFilters(params);
      const dynamicFilters = parseDynamicFilters(query);
      const allFilters = combineFilters(dynamicFilters, dateFilters);

      const series = await service.getBalanceSeries({ filters: allFilters, granularity });

      return reply.code(200).send({ data: series });
    }
  );

  /**
   * GET /balance/reach
   * Reach block for the period: Items, Numérica and Clientes sin compra
   * (bought in the 12 months before the period, not in it). Same filters as /balance.
   */
  server.get(
    '/balance/reach',
    {
      schema: {
        description: 'Items, Numérica and Clientes sin compra for the period. Supports dynamic filters.',
        tags: ['balance'],
        querystring: BalanceReachQueryStringSchema,
        response: {
          200: SuccessResponseSchema(BalanceReachSchema),
        },
      },
    },
    async (request, reply) => {
      const reach = await service.getReach(buildReachWindows(request.query));
      return reply.code(200).send({ data: reach });
    }
  );

  /**
   * GET /balance/sin-compra
   * Detail of the Clientes sin compra count, with each customer's latest seller.
   */
  server.get(
    '/balance/sin-compra',
    {
      schema: {
        description: 'Customers who bought in the 12 months before the period and not in it, with their latest seller.',
        tags: ['balance'],
        querystring: BalanceReachQueryStringSchema,
        response: {
          200: SuccessResponseSchema(FestivalSinCompraSchema),
        },
      },
    },
    async (request, reply) => {
      const rows = await service.getSinCompraList(buildReachWindows(request.query));
      return reply.code(200).send({ data: rows });
    }
  );

  /**
   * GET /balance/sin-compra/export
   * Same listing as /balance/sin-compra, streamed as a styled Excel file.
   */
  server.get(
    '/balance/sin-compra/export',
    {
      schema: {
        description: 'Export the analysis clientes-sin-compra listing as a styled Excel file.',
        tags: ['balance'],
        querystring: BalanceSinCompraExportQueryStringSchema,
        // NOTE: no response schema — the handler sends a raw xlsx Buffer.
      },
    },
    async (request, reply) => {
      const query = request.query;
      const rows = await service.getSinCompraList(buildReachWindows(query));
      const buffer = await buildSinCompraExportWorkbook({
        rows,
        periodCaption: 'Periodo',
        ...(query.reportTitle && { reportTitle: query.reportTitle }),
        ...(query.periodLabel && { periodLabel: query.periodLabel }),
        ...(query.generatedLabel && { generatedLabel: query.generatedLabel }),
      });

      return sendXlsx(reply, buffer, query.filename, 'clientes-sin-compra');
    }
  );
}
