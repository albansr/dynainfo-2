import type { GroupByDimension } from '@/core/api/hooks/useList';
import type { FilterMap } from '@/core/api/downloadExcel';

/** Config for an analysis view's metrics + drillable table. */
export interface AnalysisViewConfig {
  title: string;
  groupBy: GroupByDimension;
  totalsLabel?: string;
  filters?: FilterMap;
  hideBudgetColumns?: boolean;
  hideRetainedColumn?: boolean;
  nameOverrides?: Record<string, string>;
  /** Label for a view-native grouping dim that isn't in the standard catalog. */
  dimensionLabel?: string;
}

/**
 * Analysis views registry — the former standalone report pages (Compañía
 * General, Canales, Proveedor Comercial, Multivariados) plus the "coming soon"
 * modules, collapsed into the single home page (`/dashboard`) driven by a
 * selector. Each view carries the config its page used, plus the old route
 * `path` (kept for backward-compatible redirects and future per-role gating).
 */
export type AnalysisViewType = 'analytics' | 'soon' | 'overview';

export interface AnalysisView {
  /** Stable id used in the `?v=` query param. */
  id: string;
  /** Short label shown in the selector (matches the old sidebar item). */
  label: string;
  /** Former route path — used for legacy redirects and future role gating. */
  path: string;
  /** 'analytics' → overview + drillable table; 'soon' → "Próximamente" panel. */
  type: AnalysisViewType;
  /** Page config (metrics/table) for analytics views. */
  config?: AnalysisViewConfig;
}

export interface AnalysisViewSection {
  /** Group heading in the selector (matches the old sidebar section). */
  section: string;
  views: AnalysisView[];
}

export const ANALYSIS_VIEW_SECTIONS: AnalysisViewSection[] = [
  {
    section: 'General',
    views: [
      {
        id: 'general',
        label: 'Compañía General',
        path: '/dashboard',
        type: 'overview', // overview only (metrics + charts + qube), no table
        config: {
          title: 'Análisis',
          groupBy: 'IdRegional',
        },
      },
    ],
  },
  {
    section: 'Canales',
    views: [
      {
        id: 'distribucion',
        label: 'Distribución',
        path: '/canales/distribucion',
        type: 'analytics',
        config: {
          title: 'Análisis',
          groupBy: 'IdRegional',
          totalsLabel: 'TOTAL REGIONALES:',
          filters: { channel: 'DISTRIBUCION' },
        },
      },
      {
        id: 'exportaciones',
        label: 'Exportaciones',
        path: '/canales/exportaciones',
        type: 'analytics',
        config: {
          title: 'Análisis',
          groupBy: 'customer_country',
          totalsLabel: 'TOTAL EXPORTACIONES:',
          filters: { channel: 'EXPORTACIONES' },
          hideBudgetColumns: true,
        },
      },
      {
        id: 'cadenas',
        label: 'Cadenas',
        path: '/canales/cadenas',
        type: 'analytics',
        config: {
          title: 'Análisis',
          groupBy: 'customer_id',
          totalsLabel: 'TOTAL CADENAS:',
          filters: { channel: 'CADENAS' },
          hideBudgetColumns: true,
        },
      },
      {
        id: 'retail',
        label: 'Dynamica Retail',
        path: '/canales/retail',
        type: 'analytics',
        config: {
          title: 'Análisis',
          groupBy: 'CentroOperaciones',
          dimensionLabel: 'Centro Operaciones',
          totalsLabel: 'TOTAL RETAIL:',
          filters: { IdRegional: 'RTL' },
          hideBudgetColumns: true,
          hideRetainedColumn: true,
          nameOverrides: {
            'Punto de venta Centro 2': 'Ventas del centro de operación 006',
            'Punto de venta Itagui': 'Ventas del centro de operación 007',
            'Punto de venta Rionegro': 'Ventas del centro de operación 008',
            '006': 'Punto de venta Centro 2',
            '007': 'Punto de venta Itagui',
            '008': 'Punto de venta Rionegro',
            COD: 'Ventas C.O.D',
          },
        },
      },
    ],
  },
  {
    section: 'Proveedor Comercial',
    views: [
      {
        id: 'marcas-exclusivas',
        label: 'Marcas Exclusivas',
        path: '/proveedor-comercial/marcas',
        type: 'analytics',
        config: {
          title: 'Análisis',
          groupBy: 'ProveedorComercial',
          totalsLabel: 'TOTAL MARCAS:',
          filters: { ProveedorComercial: ['VERA', 'FORTE'] },
        },
      },
      {
        id: 'marcas-aliadas',
        label: 'Marcas Aliadas',
        path: '/proveedor-comercial/marcas-detalle',
        type: 'analytics',
        config: {
          title: 'Análisis',
          groupBy: 'ProveedorComercial',
          totalsLabel: 'TOTAL MARCAS:',
          filters: { 'ProveedorComercial[neq][]': ['VERA', 'FORTE'] },
        },
      },
    ],
  },
  {
    section: 'Multivariados',
    views: [
      {
        id: 'portafolio',
        label: 'Portafolio',
        path: '/multivariados/portafolio',
        type: 'analytics',
        config: {
          title: 'Análisis',
          groupBy: 'SegmentacionProducto',
          totalsLabel: 'TOTAL PORTAFOLIO:',
          hideBudgetColumns: true,
          hideRetainedColumn: true,
        },
      },
      {
        id: 'clientes',
        label: 'Clientes',
        path: '/multivariados/clientes',
        type: 'analytics',
        config: {
          title: 'Análisis',
          groupBy: 'SegmentacionCliente',
          totalsLabel: 'TOTAL CLIENTES:',
          hideBudgetColumns: true,
          hideRetainedColumn: true,
        },
      },
    ],
  },
  {
    section: 'Inventarios',
    views: [{ id: 'gmroi', label: 'GMROI', path: '/inventarios/gmroi', type: 'soon' }],
  },
  {
    section: 'Compañía Vinculada',
    views: [{ id: 'vera', label: 'Vera', path: '/compania-vinculada/vera', type: 'soon' }],
  },
];

const findView = (id: string): AnalysisView =>
  ANALYSIS_VIEW_SECTIONS.flatMap((s) => s.views).find((v) => v.id === id)!;

/** "Todos" = the two new channels combined (Exportaciones + Cadenas). */
const TODOS_NEW_CHANNELS_VIEW: AnalysisView = {
  id: 'todos-nuevos-canales',
  label: 'Nuevos Canales (Exp + Cad)',
  path: '/canales/nuevos-canales',
  type: 'analytics',
  config: {
    title: 'Análisis',
    groupBy: 'customer_id',
    totalsLabel: 'TOTAL NUEVOS CANALES:',
    filters: { channel: ['EXPORTACIONES', 'CADENAS'] },
    hideBudgetColumns: true,
  },
};

/** View set for the NEW_CHANNELS role: Todos + Exportaciones + Cadenas. */
export const NEW_CHANNELS_VIEW_SECTIONS: AnalysisViewSection[] = [
  {
    section: 'Nuevos Canales',
    views: [TODOS_NEW_CHANNELS_VIEW, findView('exportaciones'), findView('cadenas')],
  },
];

/** Default table for the SELLER role (no selector) — own clients via scope. */
const SELLER_DEFAULT_VIEW: AnalysisView = {
  id: 'seller-default',
  label: 'Vendedor',
  path: '/dashboard',
  type: 'analytics',
  config: {
    title: 'Análisis',
    groupBy: 'customer_id',
    totalsLabel: 'TOTAL CLIENTES:',
  },
};

/** Flat list of all views (deduped by id) for lookup by `?v=`. */
export const ANALYSIS_VIEWS: AnalysisView[] = [
  ...ANALYSIS_VIEW_SECTIONS.flatMap((s) => s.views),
  TODOS_NEW_CHANNELS_VIEW,
  SELLER_DEFAULT_VIEW,
];

/** Default view shown when none is selected (full/ADMIN-MANAGER set). */
export const DEFAULT_ANALYSIS_VIEW_ID = 'general';
