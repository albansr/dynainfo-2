import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FestivalService } from './festival.service.js';
import { AnalyticsQueryBuilder } from '../../core/db/clickhouse/query/analytics-query-builder.js';
import type { DatabaseClient } from '../../core/db/clickhouse/client.js';
import type { FilterCondition } from '../../core/db/clickhouse/query/filter-builder.js';
import {
  FestivalQueryStringSchema,
  FestivalBalanceSchema,
  FestivalListQueryStringSchema,
  FestivalListSchema,
  FestivalDailySchema,
  FESTIVAL_BRAND_GROUP,
  FESTIVAL_RAPPEL_GROUP,
  FESTIVAL_DATE_FIELDS,
  brandGroupFilters,
  rappelGroupFilters,
} from './festival.schemas.js';
import { SuccessResponseSchema } from '../../core/schemas/common.schemas.js';
import { parseDynamicFilters, combineFilters } from '../../core/utils/filter-parser.js';

/**
 * Fixed filters always applied to the festival, both windows. The festival only
 * counts distribution-channel sales — retail, exports and chains do not apply.
 * (Retail lives under IdRegional=RTL, which is outside channel=DISTRIBUCION.)
 */
const FESTIVAL_FIXED_FILTERS: FilterCondition[] = [
  { field: 'channel', operator: 'eq', value: 'DISTRIBUCION' },
];

/**
 * Expand virtual drill filters (`brand_group`, `rappel_group`) into real
 * per-table conditions so the rest of the pipeline sees normal column filters.
 * (Neither is a ClickHouse column — they are UI buckets.)
 */
function expandVirtualGroups(filters: FilterCondition[]): FilterCondition[] {
  return filters.flatMap((f) => {
    if (f.field === FESTIVAL_BRAND_GROUP) {
      return f.value === 'exclusivas' || f.value === 'aliadas' ? brandGroupFilters(f.value) : [];
    }
    if (f.field === FESTIVAL_RAPPEL_GROUP) {
      return f.value === 'con_rappel' || f.value === 'sin_rappel' ? rappelGroupFilters(f.value) : [];
    }
    return [f];
  });
}

/**
 * Build gte/lte date-range filters for the festival, scoped per table on its
 * ORDER-date column (see FESTIVAL_DATE_FIELDS — an unscoped filter would zero
 * the balance or leave the listing unbounded in time).
 */
function dateRangeFilters(start: string, end: string): FilterCondition[] {
  return Object.entries(FESTIVAL_DATE_FIELDS).flatMap(([table, field]): FilterCondition[] => [
    { field, operator: 'gte', value: start, table },
    { field, operator: 'lte', value: end, table },
  ]);
}

/**
 * Build the event-window and (optional) comparison-window filter sets.
 * Dynamic filters (compare* dates are reserved) apply to both windows.
 * `comparisonFilters` is undefined when the query has no comparison window.
 */
function buildWindows(query: {
  startDate: string; endDate: string; compareStartDate?: string; compareEndDate?: string;
}): { currentFilters: FilterCondition[]; comparisonFilters?: FilterCondition[] } {
  // Distribution-only is enforced server-side; brand_group buckets are expanded.
  const dynamicFilters = [
    ...FESTIVAL_FIXED_FILTERS,
    ...expandVirtualGroups(parseDynamicFilters(query as Record<string, unknown>)),
  ];
  const currentFilters = combineFilters(dynamicFilters, dateRangeFilters(query.startDate, query.endDate));
  if (query.compareStartDate && query.compareEndDate) {
    return {
      currentFilters,
      comparisonFilters: combineFilters(dynamicFilters, dateRangeFilters(query.compareStartDate, query.compareEndDate)),
    };
  }
  return { currentFilters };
}

/**
 * Register Festival Virtual routes.
 */
export function festivalRoutes(
  fastify: FastifyInstance,
  dbClient: DatabaseClient
): void {
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

  const analyticsBuilder = new AnalyticsQueryBuilder(dbClient.getClient());
  const service = new FestivalService(analyticsBuilder);

  /**
   * GET /festival
   * Festival dashboard metrics for a fixed event window compared against a
   * fixed comparison window. Dynamic filters apply to both windows.
   */
  server.get(
    '/festival',
    {
      schema: {
        description: 'Festival Virtual metrics: sales (+comprometido), margin, growth and rappel for a fixed event window vs a fixed comparison window.',
        tags: ['festival'],
        querystring: FestivalQueryStringSchema,
        response: {
          200: SuccessResponseSchema(FestivalBalanceSchema),
        },
      },
    },
    async (request, reply) => {
      const balance = await service.getFestivalBalance(buildWindows(request.query));
      return reply.code(200).send({ data: balance });
    }
  );

  /**
   * GET /festival/list
   * Festival metrics grouped by an arbitrary dimension (groupBy, defaults to
   * ProveedorComercial), ordered by event sales. Same date/comparison/filters
   * contract as /festival.
   */
  server.get(
    '/festival/list',
    {
      schema: {
        description: 'Festival metrics grouped by the requested dimension for the event window vs the comparison window.',
        tags: ['festival'],
        querystring: FestivalListQueryStringSchema,
        response: {
          200: SuccessResponseSchema(FestivalListSchema),
        },
      },
    },
    async (request, reply) => {
      const windows = buildWindows(request.query);
      const groupBy = request.query.groupBy;
      // "Marcas" and "Rappel" are virtual groupings (buckets), not real columns.
      const rows = groupBy === FESTIVAL_BRAND_GROUP
        ? await service.getFestivalBrandGroups({ currentFilters: windows.currentFilters })
        : groupBy === FESTIVAL_RAPPEL_GROUP
          ? await service.getFestivalRappelGroups({ currentFilters: windows.currentFilters })
          : await service.getFestivalList({ ...windows, ...(groupBy && { groupBy }) });
      return reply.code(200).send({ data: rows });
    }
  );

  /**
   * GET /festival/daily
   * Daily sales series (facturado + comprometido) over the event window.
   * Same date/filter contract as /festival; the comparison window is ignored.
   */
  server.get(
    '/festival/daily',
    {
      schema: {
        description: 'Festival daily sales series (facturado + comprometido) for the event window.',
        tags: ['festival'],
        querystring: FestivalQueryStringSchema,
        response: {
          200: SuccessResponseSchema(FestivalDailySchema),
        },
      },
    },
    async (request, reply) => {
      const { currentFilters } = buildWindows(request.query);
      const rows = await service.getFestivalDailySales({ currentFilters });
      return reply.code(200).send({ data: rows });
    }
  );
}
