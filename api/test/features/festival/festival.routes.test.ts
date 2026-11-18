import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

const mockGetFestivalList = vi.fn();

vi.mock('../../../src/features/festival/festival.service.js', () => ({
  FestivalService: vi.fn(function () {
    // @ts-expect-error - mocking constructor
    this.getFestivalList = mockGetFestivalList;
  }),
}));

vi.mock('../../../src/core/db/clickhouse/query/analytics-query-builder.js', () => ({
  AnalyticsQueryBuilder: vi.fn(),
}));

import { festivalRoutes } from '../../../src/features/festival/festival.routes.js';
import { FESTIVAL_PPTO_TABLE } from '../../../src/features/festival/festival.schemas.js';
import type { FilterCondition } from '../../../src/core/db/clickhouse/query/filter-builder.js';
import type { DatabaseClient } from '../../../src/core/db/clickhouse/client.js';

describe('festival role filters', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetFestivalList.mockResolvedValue([]);
    app = Fastify();
    app.setValidatorCompiler(() => () => true);
    app.setSerializerCompiler(() => (data) => JSON.stringify(data));
    festivalRoutes(app, { getClient: vi.fn().mockReturnValue({}) } as unknown as DatabaseClient);
  });

  afterEach(async () => {
    await app.close();
  });

  const listFilters = async (query: string): Promise<FilterCondition[]> => {
    await app.inject({ method: 'GET', url: `/festival/list?startDate=2026-11-18&endDate=2026-11-22&${query}` });
    return mockGetFestivalList.mock.calls[0]![0].currentFilters;
  };

  it('keeps the director channel filter off the budget table so seller budgets survive', async () => {
    const filters = await listFilters('channel=DISTRIBUCION&groupBy=seller_id');
    const channel = filters.filter((f) => f.field === 'channel');

    expect(channel.length).toBeGreaterThan(0);
    expect(channel.every((f) => f.table === 'transactions' || f.table === 'pedidos_retenidos')).toBe(true);
  });

  it('still narrows the budget table by the director regionals', async () => {
    const filters = await listFilters('channel=DISTRIBUCION&IdRegional=01&groupBy=seller_id');

    expect(filters).toContainEqual(expect.objectContaining({ field: 'IdRegional', table: FESTIVAL_PPTO_TABLE }));
  });
});
