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
  FestivalListExportQueryStringSchema,
  FestivalListSchema,
  FestivalDailySchema,
  FestivalSinCompraSchema,
  FestivalSinCompraExportQueryStringSchema,
  FESTIVAL_BRAND_GROUP,
  FESTIVAL_RAPPEL_GROUP,
  FESTIVAL_DATE_FIELDS,
  FESTIVAL_PPTO_TABLE,
  brandGroupFilters,
  rappelGroupFilters,
  pptoPeriodoFilter,
  activeCustomerUniverseFilters,
  type FestivalListQueryString,
} from './festival.schemas.js';
import { buildFestivalExportWorkbook, buildSinCompraExportWorkbook } from './festival.export.workbook.js';
import { SuccessResponseSchema } from '../../core/schemas/common.schemas.js';
import { parseDynamicFilters, combineFilters } from '../../core/utils/filter-parser.js';
import { sanitizeFilename } from '../../core/utils/export-filename.js';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Fixed filters always applied to the festival, both windows. The festival only
 * counts distribution-channel sales — retail, exports and chains do not apply.
 * (Retail lives under IdRegional=RTL, which is outside channel=DISTRIBUCION.)
 * Scoped to the sales tables: the budget table has no channel column and is
 * distribution-only by nature — an unscoped filter would zero it.
 */
const FESTIVAL_FIXED_FILTERS: FilterCondition[] = [
  { field: 'channel', operator: 'eq', value: 'DISTRIBUCION', table: 'transactions' },
  { field: 'channel', operator: 'eq', value: 'DISTRIBUCION', table: 'pedidos_retenidos' },
];

/**
 * Drill dimensions whose column name differs (or does not exist) per table.
 * Their filters are expanded into one scoped copy per table: a scoped copy
 * referencing a missing column excludes that table's metrics entirely (0),
 * instead of silently leaving it unfiltered in grouped listings. That is the
 * desired behaviour — e.g. the budget is not splittable by provider/brand.
 */
const SCOPED_DRILL_FIELDS: Record<string, Record<string, string>> = {
  ProveedorComercial: {
    transactions: 'ProveedorComercial',
    pedidos_retenidos: 'proveedorComercial',
    [FESTIVAL_PPTO_TABLE]: 'ProveedorComercial',
  },
  Marca: {
    transactions: 'Marca',
    pedidos_retenidos: 'Marca',
    [FESTIVAL_PPTO_TABLE]: 'Marca',
  },
  Categoria: {
    transactions: 'Categoria',
    pedidos_retenidos: 'Categoria',
    [FESTIVAL_PPTO_TABLE]: 'Categoria',
  },
};

/**
 * Expand virtual drill filters (`brand_group`, `rappel_group`) into real
 * per-table conditions so the rest of the pipeline sees normal column filters
 * (neither is a ClickHouse column — they are UI buckets), and scope the
 * per-table drill dimensions (see SCOPED_DRILL_FIELDS).
 */
function expandVirtualGroups(filters: FilterCondition[]): FilterCondition[] {
  return filters.flatMap((f) => {
    if (f.field === FESTIVAL_BRAND_GROUP) {
      return f.value === 'exclusivas' || f.value === 'aliadas' ? brandGroupFilters(f.value) : [];
    }
    if (f.field === FESTIVAL_RAPPEL_GROUP) {
      return f.value === 'con_rappel' || f.value === 'sin_rappel' ? rappelGroupFilters(f.value) : [];
    }
    const scoped = SCOPED_DRILL_FIELDS[f.field];
    if (scoped && !f.table) {
      return Object.entries(scoped).map(([table, field]) => ({ ...f, field, table }));
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
 * Build the event-window and (optional) comparison-window filter sets, plus
 * the active-year customer universe for `clientes_sin_compra` (same dynamic
 * filters, but bounded by the event's year instead of the event window).
 * Dynamic filters (compare* dates are reserved) apply to both windows.
 * `comparisonFilters` is undefined when the query has no comparison window.
 */
function buildWindows(query: {
  startDate: string; endDate: string; compareStartDate?: string; compareEndDate?: string;
}): {
  currentFilters: FilterCondition[];
  comparisonFilters?: FilterCondition[];
  universeFilters: FilterCondition[];
} {
  // Distribution-only is enforced server-side; brand_group buckets are expanded.
  const dynamicFilters = [
    ...FESTIVAL_FIXED_FILTERS,
    ...expandVirtualGroups(parseDynamicFilters(query as Record<string, unknown>)),
  ];
  // The budget joins each window via its edition (periodo), not via dates.
  const currentFilters = combineFilters(dynamicFilters, [
    ...dateRangeFilters(query.startDate, query.endDate),
    pptoPeriodoFilter(query.startDate),
  ]);
  const universeFilters = combineFilters(dynamicFilters, activeCustomerUniverseFilters(query.startDate));
  if (query.compareStartDate && query.compareEndDate) {
    return {
      currentFilters,
      comparisonFilters: combineFilters(dynamicFilters, [
        ...dateRangeFilters(query.compareStartDate, query.compareEndDate),
        pptoPeriodoFilter(query.compareStartDate),
      ]),
      universeFilters,
    };
  }
  return { currentFilters, universeFilters };
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

  /** Listing rows for the requested windows/groupBy ("Marcas"/"Promoción" are virtual buckets). */
  const fetchListRows = (query: FestivalListQueryString) => {
    const windows = buildWindows(query);
    const groupBy = query.groupBy;
    if (groupBy === FESTIVAL_BRAND_GROUP) {
      return service.getFestivalBrandGroups({
        currentFilters: windows.currentFilters,
        universeFilters: windows.universeFilters,
      });
    }
    if (groupBy === FESTIVAL_RAPPEL_GROUP) {
      return service.getFestivalRappelGroups({
        currentFilters: windows.currentFilters,
        universeFilters: windows.universeFilters,
      });
    }
    return service.getFestivalList({ ...windows, window: query, ...(groupBy && { groupBy }) });
  };

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
      const balance = await service.getFestivalBalance({
        ...buildWindows(request.query),
        window: request.query,
      });
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
      const rows = await fetchListRows(request.query);
      return reply.code(200).send({ data: rows });
    }
  );

  /**
   * GET /festival/list/export
   * Same listing as /festival/list, streamed as a styled Excel file.
   */
  server.get(
    '/festival/list/export',
    {
      schema: {
        description: 'Export the festival listing (grouped by the requested dimension) as a styled Excel file.',
        tags: ['festival'],
        querystring: FestivalListExportQueryStringSchema,
        // NOTE: no response schema — the handler sends a raw xlsx Buffer.
      },
    },
    async (request, reply) => {
      const query = request.query;
      const rows = await fetchListRows(query);
      const groupBy = query.groupBy;

      const buffer = await buildFestivalExportWorkbook({
        rows,
        dimensionLabel: query.dimensionLabel || groupBy || 'Grupo',
        includeBudget: rows.some((r) => r.presupuesto != null && r.presupuesto > 0),
        // Grouping by the counted entity itself would render a column of 1s.
        hideNumerica: groupBy === 'customer_id',
        hideItems: groupBy === 'product_id',
        ...(query.reportTitle && { reportTitle: query.reportTitle }),
        ...(query.periodLabel && { periodLabel: query.periodLabel }),
        ...(query.generatedLabel && { generatedLabel: query.generatedLabel }),
      });

      const baseName = sanitizeFilename(query.filename) || `festival-${groupBy ?? 'listado'}`;
      const asciiName = baseName.replace(/[^\x20-\x7e]+/g, '_');
      const encodedName = encodeURIComponent(`${baseName}.xlsx`);

      return reply
        .header('Content-Type', XLSX_MIME)
        .header(
          'Content-Disposition',
          `attachment; filename="${asciiName}.xlsx"; filename*=UTF-8''${encodedName}`
        )
        .send(buffer);
    }
  );

  /**
   * GET /festival/sin-compra
   * Detail of the `clientes_sin_compra` balance metric: active customers with
   * invoiced sales in the event's year and no purchase during the festival,
   * with their assigned seller. Same window/filters contract as /festival.
   */
  server.get(
    '/festival/sin-compra',
    {
      schema: {
        description: 'Clientes activos con compra en el año del evento y sin compra durante el festival, con su vendedor.',
        tags: ['festival'],
        querystring: FestivalQueryStringSchema,
        response: {
          200: SuccessResponseSchema(FestivalSinCompraSchema),
        },
      },
    },
    async (request, reply) => {
      const windows = buildWindows(request.query);
      const rows = await service.getFestivalSinCompraList({
        currentFilters: windows.currentFilters,
        universeFilters: windows.universeFilters,
      });
      return reply.code(200).send({ data: rows });
    }
  );

  /**
   * GET /festival/sin-compra/export
   * Same listing as /festival/sin-compra, streamed as a styled Excel file.
   */
  server.get(
    '/festival/sin-compra/export',
    {
      schema: {
        description: 'Export the clientes-sin-compra listing as a styled Excel file.',
        tags: ['festival'],
        querystring: FestivalSinCompraExportQueryStringSchema,
        // NOTE: no response schema — the handler sends a raw xlsx Buffer.
      },
    },
    async (request, reply) => {
      const query = request.query;
      const windows = buildWindows(query);
      const rows = await service.getFestivalSinCompraList({
        currentFilters: windows.currentFilters,
        universeFilters: windows.universeFilters,
      });

      const buffer = await buildSinCompraExportWorkbook({
        rows,
        ...(query.reportTitle && { reportTitle: query.reportTitle }),
        ...(query.periodLabel && { periodLabel: query.periodLabel }),
        ...(query.generatedLabel && { generatedLabel: query.generatedLabel }),
      });

      const baseName = sanitizeFilename(query.filename) || 'festival-clientes-sin-compra';
      const asciiName = baseName.replace(/[^\x20-\x7e]+/g, '_');
      const encodedName = encodeURIComponent(`${baseName}.xlsx`);

      return reply
        .header('Content-Type', XLSX_MIME)
        .header(
          'Content-Disposition',
          `attachment; filename="${asciiName}.xlsx"; filename*=UTF-8''${encodedName}`
        )
        .send(buffer);
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
