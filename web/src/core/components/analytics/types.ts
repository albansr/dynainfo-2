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
export type GroupByDimension =
  | 'IdRegional'
  | 'seller_id'
  | 'customer_id'
  | 'customer_name'
  | 'customer_country'
  | 'product_id'
  | 'ProveedorComercial'
  | 'month'
  | 'quarter'
  | 'SegmentacionCliente'
  | 'SegmentacionProducto';

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
}
