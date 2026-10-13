import type { FilterCondition } from '../db/clickhouse/query/filter-builder.js';

/**
 * Universe for every "clientes sin compra" figure (Festival, analysis boards,
 * Estado): the SIESA customer master (dyna_clientes, one row per NIT ×
 * sucursal with the CURRENT assignment, reloaded in full every night), not the
 * sales history — only ACTIVE customers: active, not blocked, assigned to a
 * commercial regional. Regionals outside this list (castigo, cobro jurídico,
 * retail, empleados, canales muertos…) are not sales targets.
 */
export const CUSTOMER_MASTER_TABLE = 'clientes';

export const COMMERCIAL_REGIONALS = [
  '0001', // Costa Atlántica
  '0002', // Andina (Medellín)
  '0003', // Costa Pacífica (Cali)
  '0004', // Bogotá Ciudad
  '0015', // Canal Alternativo (Contact Center)
  '0018', // Territorio Especial
  '0019', // Centro
  '0026', // Oriente
  '0033', // Eje Centro
];

/** The channel whose customers the commercial regionals hold. */
const MASTER_CHANNEL = 'DISTRIBUCION';

/** Dashboard dimensions the master can narrow by (same column names as the sales tables). */
const MASTER_FIELDS = new Set(['IdRegional', 'seller_id', 'customer_id']);

/** Active-customer conditions, scoped to the master table. */
export function activeCustomerFilters(): FilterCondition[] {
  return [
    { field: 'activo', operator: 'eq', value: 'true', table: CUSTOMER_MASTER_TABLE },
    { field: 'bloqueado', operator: 'eq', value: 'false', table: CUSTOMER_MASTER_TABLE },
    { field: 'IdRegional', operator: 'in', value: COMMERCIAL_REGIONALS, table: CUSTOMER_MASTER_TABLE },
  ];
}

/**
 * Active-customer universe narrowed by the request filters the master can
 * express (regional, seller, customer), each scoped to the master. Other
 * filters (channel, provider, brand…) only narrow the purchases subtracted from
 * it: e.g. on Marcas Exclusivas, a non-buyer is an active customer who did not
 * buy those brands.
 */
export function masterUniverseFilters(filters: FilterCondition[]): FilterCondition[] {
  const narrowing = filters
    .filter((f) => MASTER_FIELDS.has(f.field) && (!f.table || f.table === CUSTOMER_MASTER_TABLE))
    .map((f) => ({ ...f, table: CUSTOMER_MASTER_TABLE }));
  return [...activeCustomerFilters(), ...narrowing];
}

const values = (f: FilterCondition): string[] => (Array.isArray(f.value) ? f.value : [f.value]);

/** Whether a set of values selected by `f` can include `candidates`. */
function selects(f: FilterCondition, candidates: string[]): boolean {
  if (f.operator === 'eq' || f.operator === 'in') return values(f).some((v) => candidates.includes(v));
  if (f.operator === 'neq') return candidates.some((c) => !values(f).includes(c));
  return true;
}

/**
 * Whether the active-customer master covers a board's filters. It only holds
 * Distribución's commercial regionals, so boards narrowed to another channel
 * (Exportaciones, Cadenas) or to non-commercial regionals (Retail = RTL) have
 * no meaningful "sin compra" figure.
 */
export function coversCustomerMaster(filters: FilterCondition[]): boolean {
  return filters.every((f) => {
    if (f.field === 'channel') return selects(f, [MASTER_CHANNEL]);
    if (f.field === 'IdRegional') return selects(f, COMMERCIAL_REGIONALS);
    return true;
  });
}
