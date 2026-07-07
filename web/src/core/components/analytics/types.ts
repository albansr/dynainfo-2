import type { ReactNode } from 'react';
import type { ColumnDefinition, ColumnGroup } from '@/features/distribution/components/RegionalTable/config/types';
import type { BalanceSheetData } from '@/core/api/types';

/**
 * Configuration for metric blocks displayed at the top of analytics pages
 */
export interface MetricBlockConfig {
  label: string;
  valueKey: keyof BalanceSheetData;
  format: 'currency' | 'number' | 'percentage';
}

/**
 * Balance data structure from useBalance hook
 * Re-exported from API types for convenience
 */
export type BalanceData = BalanceSheetData;

/**
 * Available grouping dimensions for analytics
 */
import type { GroupByDimension } from '@/core/api/hooks/useList';
export type { GroupByDimension };

/**
 * Generic row data for analytics table
 */
export interface AnalyticsRow {
  [key: string]: string | number | null | undefined;
}

/**
 * Configuration for creating a new analytics page
 */
export interface AnalyticsPageConfig {
  /**
   * Page title displayed at the top
   * @example "Canales / Distribución"
   */
  title: string;

  /**
   * Dimension to group data by
   * @example "IdRegional"
   */
  groupBy: GroupByDimension;

  /**
   * Label for the totals row in the table
   * @default "TOTAL:"
   * @example "TOTAL REGIONALES:"
   */
  totalsLabel?: string;

  /**
   * Global filters applied to both metrics and table data
   * These filters are sent to the API alongside dates
   * @example { type: 'export' }
   * @example { brand_type: 'own' }
   */
  filters?: Record<string, any>;

  /**
   * Preset configuration for metrics
   * @default "standard"
   */
  metricsPreset?: 'standard';

  /**
   * Custom metrics configuration (overrides preset)
   */
  customMetrics?: MetricBlockConfig[];

  /**
   * Custom column definitions for the table (overrides default)
   */
  tableColumns?: ColumnDefinition[];

  /**
   * Custom column groups for the table (overrides default)
   */
  tableColumnGroups?: ColumnGroup[];

  /**
   * Hide budget-related columns from the table
   * When true, hides "Presupuesto" and "Margen Presupuesto" columns
   * and changes "Margen Real" label to just "Margen"
   * @default false
   */
  hideBudgetColumns?: boolean;

  /**
   * Hide the "Retenido en Cartera" column from the table
   * @default false
   */
  hideRetainedColumn?: boolean;

  /**
   * Override display names for specific row IDs
   * Maps the raw ID/name from the API to a custom display label
   * @example { 'COD': 'Ventas C.O.D', '006': 'Ventas del centro de operación 006' }
   */
  nameOverrides?: Record<string, string>;

  /**
   * Hide the top metric cards, showing only the title + table (+ export).
   * @default false
   */
  hideMetrics?: boolean;

  /**
   * Prefix each row's name with its ID ("{id} - {name}"), e.g. to disambiguate
   * regionals or customers that may share a name.
   * @default false
   */
  showIdInName?: boolean;

  /**
   * Override the first (dimension) column header label and the export label.
   * Defaults to the dimension's semantic label (e.g. seller_id → "VENDEDOR").
   * @example "COMERCIALES"
   */
  dimensionLabel?: string;

  /**
   * Rows per page for the table. Pagination controls appear when the dataset
   * spans more than one page. Backend maximum is 100.
   * @default 50
   */
  pageSize?: number;

  /**
   * Show a search input (by name or ID) that filters server-side across the
   * whole dataset (not just the current page).
   * @default false
   */
  showSearch?: boolean;

  /**
   * When set, each table row becomes clickable and navigates to
   * `${detailBasePath}/${row.id}` (passing the row name via router state).
   */
  detailBasePath?: string;

  /**
   * When true, rows drill into the generic distribution detail explorer
   * (`/distribucion/detalle`) grouped/filtered by the clicked value.
   */
  drillToDetail?: boolean;

  /** Show the faceted multi-select filter bar above the table. */
  enableFilters?: boolean;

  /** Context (e.g. channel) that scopes the filter value options. */
  filterContext?: Record<string, any>;

  /** Breadcrumbs rendered above the page title. */
  breadcrumbs?: ReactNode;
}
