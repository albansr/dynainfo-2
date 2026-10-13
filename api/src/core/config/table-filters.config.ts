import type { FilterCondition } from '../db/clickhouse/query/filter-builder.js';

/**
 * Regionals of each sales channel, as they appear in dyna_transactions (every
 * regional belongs to exactly one channel). dyna_cartera has no `channel`
 * column, so it is narrowed to a channel through its regionals instead of
 * reading 0 (or the whole company).
 */
export const CHANNEL_REGIONALS: Record<string, string[]> = {
  DISTRIBUCION: [
    '0001', '0002', '0003', '0004', '0009', '0015', '0018', '0019',
    '0025', '0026', '0029', '0032', '0033', '0034', '9999',
  ],
  CADENAS: ['0010'],
  EXPORTACIONES: ['0016'],
  RETAIL: ['RTL'],
  'Sin DETERMINAR': ['RTL'],
};

/**
 * dyna_cartera quirks (until its ETL carries `channel` and trimmed ids): it has
 * IdRegional but no channel column, and some rows pad IdRegional with spaces.
 */
const CARTERA_TABLE = 'cartera';

/**
 * Filters as a table can apply them: on dyna_cartera, a `channel` condition
 * becomes its regionals and IdRegional conditions compare the trimmed value.
 * Other tables get the filters unchanged.
 */
export function adaptFiltersForTable(filters: FilterCondition[], table: string): FilterCondition[] {
  if (table !== CARTERA_TABLE) return filters;
  return filters.flatMap((f) => {
    if (f.field === 'channel') return channelAsRegionalFilters(f);
    if (f.field === 'IdRegional') return [{ ...f, trim: true }];
    return [f];
  });
}

/**
 * A `channel` condition expressed as IdRegional conditions: eq/in → the
 * channels' regionals; neq → one exclusion per regional of that channel.
 */
function channelAsRegionalFilters(f: FilterCondition): FilterCondition[] {
  const channels = Array.isArray(f.value) ? f.value : [f.value];
  const regionals = [...new Set(channels.flatMap((c) => CHANNEL_REGIONALS[c] ?? []))];
  const base = { field: 'IdRegional', trim: true, ...(f.table && { table: f.table }) } as const;
  if (f.operator === 'neq') {
    return regionals.map((value) => ({ ...base, operator: 'neq', value }));
  }
  // An unknown channel has no regionals: match nothing rather than everything
  return [{ ...base, operator: 'in', value: regionals.length > 0 ? regionals : ['__none__'] }];
}

/**
 * Groupings every metric table splits cleanly (sales, orders, budget and
 * cartera all carry them filled in). Listings by these include groups with no
 * sales in the period (e.g. a seller with only budget or cartera), so their
 * budget and RET. CARTERA are not dropped. Other groupings stay driven by the
 * sales rows: budget and cartera leave customers/products empty there, which
 * would surface as a misleading "Sin Determinar" row.
 */
const GROUPINGS_FROM_EVERY_SOURCE = new Set(['seller_id', 'IdRegional', 'ProveedorComercial', 'channel']);

export function listsGroupsWithoutSales(groupBy: string): boolean {
  return GROUPINGS_FROM_EVERY_SOURCE.has(groupBy);
}
