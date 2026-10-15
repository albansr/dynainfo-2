import { ANALYSIS_VIEWS } from '@/core/config/analysisViews';
import { DETAIL_PATH, DIM_LABEL } from '@/core/config/breakdownDimensions';
import { getRoleLabel } from '@/core/config/access';
import type { SupportContext } from '../hooks/useSupport';
import { dateRangeText } from './supportContext';

/** A context described for people: the page by name and each filter by its label. */
export interface ContextSummary {
  page: string;
  items: { label: string; value: string }[];
}

const PAGE_LABEL: Record<string, string> = {
  '/dashboard': 'Análisis',
  '/festival-virtual': 'Festival Virtual',
  [DETAIL_PATH]: 'Detalle',
  '/estado': 'Estado',
  '/soporte': 'Soporte',
  '/configuracion': 'Configuración',
};

const BRAND_GROUP_LABEL: Record<string, string> = { exclusivas: 'Marcas Exclusivas', aliadas: 'Marcas Aliadas' };

/** Query keys that describe the page itself, not a filter. */
const PAGE_KEYS = new Set(['v', 'trail', 'g']);

const capitalize = (text: string) => (text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : text);

function pageName(path: string, params: URLSearchParams): string {
  const base = PAGE_LABEL[path] ?? (path.startsWith('/estado/') ? 'Estado' : path || 'DynaInfo');
  const view = params.get('v') ? ANALYSIS_VIEWS.find((v) => v.id === params.get('v')) : undefined;
  const trail = (params.get('trail') ?? '').split('|').filter(Boolean);
  if (view) return `${base} · ${view.label}`;
  if (trail.length > 0) return `${base} · ${trail.join(' › ')}`;
  return base;
}

/** "ProveedorComercial[neq][]" → { dim: "ProveedorComercial", excluded: true } */
function parseKey(key: string): { dim: string; excluded: boolean } {
  const dim = key.replace(/\[.*$/, '');
  return { dim, excluded: /\[neq\]/.test(key) };
}

function filterItems(params: URLSearchParams): { label: string; value: string }[] {
  const byLabel = new Map<string, string[]>();
  for (const [key, raw] of params.entries()) {
    if (PAGE_KEYS.has(key)) continue;
    const { dim, excluded } = parseKey(key);
    const label = `${DIM_LABEL[dim] ?? dim}${excluded ? ' (excepto)' : ''}`;
    const value = dim === 'brand_group' ? (BRAND_GROUP_LABEL[raw] ?? raw) : dim === 'channel' ? capitalize(raw) : raw;
    byLabel.set(label, [...(byLabel.get(label) ?? []), value]);
  }
  return Array.from(byLabel, ([label, values]) => ({ label, value: values.join(', ') }));
}

/**
 * Describe a support context for people (the form preview, the agent panel and
 * the team email): "Detalle · Marcas Exclusivas", "Agrupado por: Proveedor",
 * "Fechas: Acumulado · 01/01/2026 - 30/09/2026", "Rol: Vendedor · CL07".
 */
export function describeContext(context: Partial<SupportContext>): ContextSummary {
  const params = new URLSearchParams(context.search ?? '');
  const items = filterItems(params);
  const groupBy = params.get('g');
  if (groupBy) items.unshift({ label: 'Agrupado por', value: DIM_LABEL[groupBy] ?? groupBy });
  if (context.dateRange) items.push({ label: 'Fechas', value: dateRangeText(context.dateRange) });
  if (context.dynaRole !== undefined) {
    const role = getRoleLabel(context.dynaRole) || 'Sin rol';
    items.push({ label: 'Rol', value: context.scope ? `${role} · ${context.scope}` : role });
  }
  return { page: pageName(context.path ?? '', params), items };
}
