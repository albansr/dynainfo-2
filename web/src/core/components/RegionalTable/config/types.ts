import type { ReactNode } from 'react';
import type { RegionalData, TableConfig } from '../types';

// Cell renderer receives the full row data and config. `T` defaults to a
// flexible value type so columns can render heterogeneous metric shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CellRenderer<T = any> = (
  data: RegionalData,
  config: TableConfig,
  value: T
) => ReactNode;

// Value accessor gets the value from the row data (flexible default value type).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
