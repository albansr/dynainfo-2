import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { ListService, ExportTooLargeError } from './list.service.js';
import { AnalyticsQueryBuilder } from '../../core/db/clickhouse/query/analytics-query-builder.js';
import type { DatabaseClient } from '../../core/db/clickhouse/client.js';
import type { GroupByDimension } from './list.schemas.js';
import { ListExportQueryStringSchema } from './list.export.schemas.js';
import { parseListFilters } from './list.filters.js';
import { mapListItemToExportRow, calculateExportTotals, usesFacturadoOnly } from './list.export.transform.js';
import { buildListExportWorkbook } from './list.export.workbook.js';
import { sanitizeFilename } from '../../core/utils/export-filename.js';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';


/**
 * Register the list Excel export route.
 * GET /list/export -> streams a styled .xlsx of the full filtered dataset.
 */
export function listExportRoutes(fastify: FastifyInstance, dbClient: DatabaseClient): void {
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

  const analyticsBuilder = new AnalyticsQueryBuilder(dbClient.getClient());
  const service = new ListService(analyticsBuilder);

  server.get(
    '/list/export',
    {
      schema: {
        description: 'Export the full (unpaginated) grouped list as a styled Excel file.',
        tags: ['list'],
        querystring: ListExportQueryStringSchema,
        // NOTE: no response schema — the handler sends a raw xlsx Buffer.
      },
    },
    async (request, reply) => {
      const query = request.query;
      const parsed = parseListFilters(query as Record<string, unknown>);

      try {
        const items = await service.getBalanceListForExport({
          groupBy: parsed.groupBy as GroupByDimension,
          ...(parsed.orderBy && { orderBy: parsed.orderBy }),
          ...(parsed.orderDirection && { orderDirection: parsed.orderDirection }),
          filters: parsed.filters,
          facturadoOnly: usesFacturadoOnly(query.preset),
        });

        // Optional display-name overrides (raw name -> label)
        let nameOverrides: Record<string, string> | undefined;
        if (query.nameOverrides) {
          try {
            const parsedOverrides = JSON.parse(query.nameOverrides);
            if (parsedOverrides && typeof parsedOverrides === 'object') {
              nameOverrides = parsedOverrides as Record<string, string>;
            }
          } catch {
            // ignore malformed overrides — fall back to raw names
          }
        }

        const rows = items.map((item) => mapListItemToExportRow(item, query.preset, nameOverrides));
        const totalsLabel = query.totalsLabel || 'TOTAL:';
        const totals = calculateExportTotals(rows, totalsLabel);

        const currentYear = query.currentYear ?? new Date().getFullYear();
        const previousYear = query.previousYear ?? currentYear - 1;

        const buffer = await buildListExportWorkbook({
          rows,
          totals,
          hideBudgetColumns: query.hideBudgetColumns === true,
          hideRetainedColumn: query.hideRetainedColumn === true,
          showProductCode: parsed.groupBy === 'product_id',
          dimensionLabel: query.dimensionLabel || parsed.groupBy,
          billingLabel: query.billingLabel || 'Ventas VS Presupuesto',
          totalsLabel,
          currentYear,
          previousYear,
          ...(query.reportTitle && { reportTitle: query.reportTitle }),
          ...(query.periodLabel && { periodLabel: query.periodLabel }),
          ...(query.generatedLabel && { generatedLabel: query.generatedLabel }),
        });

        const baseName = sanitizeFilename(query.filename) || `export-${parsed.groupBy}`;
        const asciiName = baseName.replace(/[^\x20-\x7e]+/g, '_');
        const encodedName = encodeURIComponent(`${baseName}.xlsx`);

        return reply
          .header('Content-Type', XLSX_MIME)
          .header(
            'Content-Disposition',
            `attachment; filename="${asciiName}.xlsx"; filename*=UTF-8''${encodedName}`
          )
          .send(buffer);
      } catch (error) {
        if (error instanceof ExportTooLargeError) {
          return reply.code(400).send({ error: 'EXPORT_TOO_LARGE', message: error.message });
        }
        throw error;
      }
    }
  );
}
