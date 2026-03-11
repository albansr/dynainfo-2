import type { ClickHouseClient } from '@clickhouse/client';
import type { FilterCondition } from '../../core/db/clickhouse/query/filter-builder.js';
import { FilterBuilder } from '../../core/db/clickhouse/query/filter-builder.js';
import { buildQube6Query, buildQube6DistributionQuery } from './qube6.query.js';
import type { Qube6Response, Qube6DistributionResponse, SegmentDistributionItem } from './qube6.schemas.js';

interface Qube6AnalysisParams {
  groupBy: string;
  id: string;
  filters: FilterCondition[];
}

interface Qube6DistributionParams {
  groupBy: string;
  filters: FilterCondition[];
}

const ANALYSIS_TYPES = ['value', 'sales', 'profit', 'quality'] as const;

export class Qube6Service {
  private filterBuilder: FilterBuilder;

  constructor(private client: ClickHouseClient) {
    this.filterBuilder = new FilterBuilder();
  }

  async getAnalysis({ groupBy, id, filters }: Qube6AnalysisParams): Promise<Qube6Response> {
    const previousFilters = this.filterBuilder.shiftDateFilters(filters, -1);

    const { query, queryParams } = buildQube6Query({
      groupBy,
      id,
      currentFilters: filters,
      previousFilters,
    });

    const result = await this.client.query({
      query,
      query_params: queryParams,
      format: 'JSONEachRow',
    });

    const rows = await result.json() as Record<string, unknown>[];

    if (rows.length === 0) {
      throw new Error(`No data found for ${groupBy} = ${id}`);
    }

    return transformResult(rows[0]!);
  }

  async getDistribution({ groupBy, filters }: Qube6DistributionParams): Promise<Qube6DistributionResponse> {
    const previousFilters = this.filterBuilder.shiftDateFilters(filters, -1);

    const { query, queryParams } = buildQube6DistributionQuery({
      groupBy,
      currentFilters: filters,
      previousFilters,
    });

    const result = await this.client.query({
      query,
      query_params: queryParams,
      format: 'JSONEachRow',
    });

    const rows = await result.json() as Record<string, unknown>[];

    return transformDistributionResult(rows);
  }
}

function transformResult(row: Record<string, unknown>): Qube6Response {
  return {
    value: {
      fine_y: String(row['value_fine_y'] ?? ''),
      fine_x: String(row['value_fine_x'] ?? ''),
      short: String(row['value_short'] ?? ''),
      fine_id: Number(row['value_fine_id'] ?? 0),
    },
    sales: {
      fine_y: String(row['sales_fine_y'] ?? ''),
      fine_x: String(row['sales_fine_x'] ?? ''),
      short: String(row['sales_short'] ?? ''),
      fine_id: Number(row['sales_fine_id'] ?? 0),
    },
    profit: {
      fine_y: String(row['profit_fine_y'] ?? ''),
      fine_x: String(row['profit_fine_x'] ?? ''),
      short: String(row['profit_short'] ?? ''),
      fine_id: Number(row['profit_fine_id'] ?? 0),
    },
    quality: {
      fine_y: String(row['quality_fine_y'] ?? ''),
      fine_x: String(row['quality_fine_x'] ?? ''),
      short: String(row['quality_short'] ?? ''),
      fine_id: Number(row['quality_fine_id'] ?? 0),
    },
  };
}

function transformDistributionResult(rows: Record<string, unknown>[]): Qube6DistributionResponse {
  const result: Qube6DistributionResponse = { value: [], sales: [], profit: [], quality: [] };

  const accumulators: Record<string, Map<string, { count: number; sales: number; gross_margin: number }>> = {};
  for (const type of ANALYSIS_TYPES) {
    accumulators[type] = new Map();
  }

  for (const row of rows) {
    const entityCount = Number(row['entity_count'] ?? 0);
    const totalSales = Number(row['total_sales'] ?? 0);
    const totalGrossMargin = Number(row['total_gross_margin'] ?? 0);

    for (const type of ANALYSIS_TYPES) {
      const short = String(row[`${type}_short`] ?? '');
      if (!short) continue;

      const map = accumulators[type]!;
      const existing = map.get(short);
      if (existing) {
        existing.count += entityCount;
        existing.sales += totalSales;
        existing.gross_margin += totalGrossMargin;
      } else {
        map.set(short, { count: entityCount, sales: totalSales, gross_margin: totalGrossMargin });
      }
    }
  }

  for (const type of ANALYSIS_TYPES) {
    const map = accumulators[type]!;
    const items: SegmentDistributionItem[] = [];
    for (const [short, data] of map) {
      items.push({ short, ...data });
    }
    result[type] = items;
  }

  return result;
}
