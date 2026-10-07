import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { DatabaseClient } from '../../../src/core/db/clickhouse/client.js';

// The real routes + service run; only the ClickHouse query builder is mocked
const builder = {
  buildMultiTableYoYQuery: vi.fn(),
  buildDistinctCountQuery: vi.fn(),
  buildDistinctCountExcludingQuery: vi.fn(),
  buildDistinctDetailsExcludingQuery: vi.fn(),
};

vi.mock('../../../src/core/db/clickhouse/query/analytics-query-builder.js', () => ({
  AnalyticsQueryBuilder: vi.fn(function (this: Record<string, unknown>) {
    Object.assign(this, builder);
  }),
}));

const { balanceRoutes } = await import('../../../src/features/balance/balance.routes.js');
const { historyWindow } = await import('../../../src/features/balance/balance.service.js');
const { BALANCE_METRICS, PRODUCT_UNIT_METRICS } = await import('../../../src/core/config/metrics.config.js');

const dbClient = { getClient: () => ({}) } as unknown as DatabaseClient;

const period = (start: string, end: string) => [
  { field: 'date', operator: 'gte', value: start },
  { field: 'date', operator: 'lte', value: end },
];

describe('historyWindow', () => {
  it('covers the 12 months before the period start', () => {
    expect(historyWindow('2026-10-01')).toEqual({ startDate: '2025-10-01', endDate: '2026-09-30' });
    expect(historyWindow('2026-01-01')).toEqual({ startDate: '2025-01-01', endDate: '2025-12-31' });
    expect(historyWindow('2026-03-01')).toEqual({ startDate: '2025-03-01', endDate: '2026-02-28' });
  });
});

describe('Balance reach routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify({ logger: false });
    balanceRoutes(app, dbClient);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /balance includeUnits (opt-in)', () => {
    beforeEach(() => builder.buildMultiTableYoYQuery.mockResolvedValue({}));

    it('queries exactly the usual metrics without the flag (unchanged for existing clients)', async () => {
      const response = await app.inject({ method: 'GET', url: '/balance?startDate=2026-09-01&endDate=2026-09-30' });

      expect(response.statusCode).toBe(200);
      expect(builder.buildMultiTableYoYQuery.mock.calls[0]![0].metrics).toEqual(BALANCE_METRICS);
      expect(response.json().data).not.toHaveProperty('units');
    });

    it('adds the units and cost metrics with includeUnits=true', async () => {
      await app.inject({ method: 'GET', url: '/balance?startDate=2026-09-01&endDate=2026-09-30&includeUnits=true' });

      const [[call]] = builder.buildMultiTableYoYQuery.mock.calls;
      expect(call.metrics).toEqual([...BALANCE_METRICS, ...PRODUCT_UNIT_METRICS]);
      // The flag is a reserved param, never a dimension filter
      expect(call.currentPeriodFilters.some((f: { field: string }) => f.field === 'includeUnits')).toBe(false);
    });
  });

  describe('GET /balance/reach', () => {
    beforeEach(() => {
      builder.buildDistinctCountQuery
        .mockResolvedValueOnce(1562) // customers
        .mockResolvedValueOnce(5540); // products
      builder.buildDistinctCountExcludingQuery.mockResolvedValue(6657);
    });

    it('returns Items, Numérica and Clientes sin compra', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/balance/reach?startDate=2026-10-01&endDate=2026-10-07',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        data: { productos_unicos: 5540, clientes_unicos: 1562, clientes_sin_compra: 6657 },
      });
    });

    it('counts invoiced + pending orders for open periods, deduped between them', async () => {
      await app.inject({ method: 'GET', url: '/balance/reach?startDate=2026-10-01&endDate=2026-10-07&channel=DISTRIBUCION' });

      const channel = { field: 'channel', operator: 'eq', value: 'DISTRIBUCION' };
      expect(builder.buildDistinctCountQuery).toHaveBeenCalledWith({
        sources: [
          { table: 'transactions', field: 'customer_id' },
          { table: 'pedidos_retenidos', field: 'customer_id' },
        ],
        filters: [...period('2026-10-01', '2026-10-07'), channel],
      });
      expect(builder.buildDistinctCountQuery).toHaveBeenCalledWith(
        expect.objectContaining({ sources: expect.arrayContaining([{ table: 'pedidos_retenidos', field: 'product_id' }]) })
      );
    });

    it('measures "sin compra" as last-12-months buyers who did not buy in the period, same filters', async () => {
      await app.inject({ method: 'GET', url: '/balance/reach?startDate=2026-10-01&endDate=2026-10-07&channel=DISTRIBUCION' });

      const channel = { field: 'channel', operator: 'eq', value: 'DISTRIBUCION' };
      expect(builder.buildDistinctCountExcludingQuery).toHaveBeenCalledWith({
        universe: {
          table: 'transactions',
          field: 'customer_id',
          filters: [...period('2025-10-01', '2026-09-30'), channel],
        },
        exclude: {
          sources: [
            { table: 'transactions', field: 'customer_id' },
            { table: 'pedidos_retenidos', field: 'customer_id' },
          ],
          filters: [...period('2026-10-01', '2026-10-07'), channel],
        },
      });
    });

    it('uses invoiced sales only for closed periods', async () => {
      await app.inject({ method: 'GET', url: '/balance/reach?startDate=2026-09-01&endDate=2026-09-30&facturadoOnly=true' });

      for (const [call] of builder.buildDistinctCountQuery.mock.calls) {
        expect(call.sources.map((s: { table: string }) => s.table)).toEqual(['transactions']);
      }
      const [[excluding]] = builder.buildDistinctCountExcludingQuery.mock.calls;
      expect(excluding.exclude.sources.map((s: { table: string }) => s.table)).toEqual(['transactions']);
    });

    it('requires the period', async () => {
      const response = await app.inject({ method: 'GET', url: '/balance/reach?startDate=2026-10-01' });

      expect(response.statusCode).toBe(400);
      expect(builder.buildDistinctCountQuery).not.toHaveBeenCalled();
    });
  });

  describe('GET /balance/sin-compra', () => {
    it('lists the same universe with the seller of each customer\'s latest purchase', async () => {
      builder.buildDistinctDetailsExcludingQuery.mockResolvedValue([
        { customer_id: '900085827', customer_name: 'ABC LTDA', seller_id: 'CL01', seller_name: 'CL01-TORRENTE' },
      ]);

      const response = await app.inject({
        method: 'GET',
        url: '/balance/sin-compra?startDate=2026-10-01&endDate=2026-10-07',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual([
        { customer_id: '900085827', customer_name: 'ABC LTDA', seller_id: 'CL01', seller_name: 'CL01-TORRENTE' },
      ]);
      expect(builder.buildDistinctDetailsExcludingQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          universe: { table: 'transactions', keyField: 'customer_id', filters: period('2025-10-01', '2026-09-30') },
          attributes: ['customer_name', 'seller_id', 'seller_name'],
          dateField: 'date',
          orderBy: 'customer_name',
        })
      );
    });

    it('exports the listing as an xlsx download with a UTF-8 file name', async () => {
      builder.buildDistinctDetailsExcludingQuery.mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/balance/sin-compra/export?startDate=2026-10-01&endDate=2026-10-07&filename=Análisis_Sin_Compra&reportTitle=Análisis',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(response.headers['content-disposition']).toBe(
        `attachment; filename="An_lisis_Sin_Compra.xlsx"; filename*=UTF-8''An%C3%A1lisis_Sin_Compra.xlsx`
      );
      // xlsx files are zip archives
      expect(response.rawPayload.subarray(0, 2).toString()).toBe('PK');
    });
  });
});
