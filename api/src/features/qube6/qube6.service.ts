import type { ClickHouseClient } from '@clickhouse/client';
import type { FilterCondition } from '../../core/db/clickhouse/query/filter-builder.js';
import { FilterBuilder } from '../../core/db/clickhouse/query/filter-builder.js';
import { buildQube6Query } from './qube6.query.js';
import type { Qube6Response } from './qube6.schemas.js';

interface Qube6AnalysisParams {
  groupBy: string;
  id: string;
  filters: FilterCondition[];
}

/**
 * Service for qube6 segment analysis business logic.
 * Compares a specific entity against company averages across 4 dimensions.
 */
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
