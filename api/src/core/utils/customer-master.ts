import type { IAnalyticsQueryBuilder, FilterCondition } from '../db/clickhouse/query/interfaces.js';
import { CUSTOMER_MASTER_TABLE } from '../config/customer-master.config.js';

/** One active customer without purchases, with the seller assigned in the master. */
export interface ActiveNonBuyer {
  customer_id: string;
  customer_name: string;
  seller_id: string;
  seller_name: string;
}

/**
 * Active customers of the master (under `universeFilters`) who do not appear
 * in the exclusion sources, with the seller ASSIGNED in the master (argMax over
 * updated_at picks the latest snapshot row). Same universe/exclusion as the
 * matching count, so a "clientes sin compra" listing always matches its card.
 */
export async function listActiveNonBuyers(
  builder: IAnalyticsQueryBuilder,
  params: {
    universeFilters: FilterCondition[];
    exclude: { sources: Array<{ table: string; field: string }>; filters: FilterCondition[] };
  }
): Promise<ActiveNonBuyer[]> {
  const rows = await builder.buildDistinctDetailsExcludingQuery({
    universe: { table: CUSTOMER_MASTER_TABLE, keyField: 'customer_id', filters: params.universeFilters },
    attributes: ['customer_name', 'seller_id', 'seller_name'],
    dateField: 'updated_at',
    exclude: params.exclude,
    orderBy: 'customer_name',
  });
  return rows.map((r) => ({
    customer_id: String(r['customer_id'] ?? ''),
    customer_name: String(r['customer_name'] ?? ''),
    seller_id: String(r['seller_id'] ?? ''),
    seller_name: String(r['seller_name'] ?? ''),
  }));
}
