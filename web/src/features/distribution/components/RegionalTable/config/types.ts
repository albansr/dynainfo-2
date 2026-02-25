import { ReactNode } from 'react';
import type { RegionalData, TableConfig } from '../types';

// Cell renderer receives the full row data and config
export type CellRenderer<T = any> = (
  data: RegionalData,
  config: TableConfig,
  value: T
) => ReactNode;

// Value accessor gets the value from the row data
export type ValueAccessor<T = any> = (data: RegionalData) => T;

// Background color calculator
export type BackgroundColorFn = (
  data: RegionalData,
  config: TableConfig
) => string;

// Column alignment
export type ColumnAlign = 'left' | 'center' | 'right';

// Header configuration
export interface HeaderConfig {
  label: string;
  sortable?: boolean;
  align?: ColumnAlign;
  // For multi-level headers
  colSpan?: number;
  rowSpan?: number;
  // Dynamic label support (e.g., "VENTAS 2024")
  labelFormatter?: (config: TableConfig) => string;
}

// Main column definition
export interface ColumnDefinition<T = any> {
  id: string; // Unique column identifier
  header: HeaderConfig;

  // Data access
  accessor: ValueAccessor<T>;

  // Rendering
  cellRenderer: CellRenderer<T>;

  // Styling
  backgroundColor?: BackgroundColorFn;
  align?: ColumnAlign;

  // Sorting
  sortable?: boolean;
  sortKey?: string;

  // Column grouping (for multi-level headers)
  group?: string;
}

// Column group for multi-level headers
export interface ColumnGroup {
  id: string;
  label: string;
  columns: string[]; // Column IDs in this group
  align?: ColumnAlign;
}
