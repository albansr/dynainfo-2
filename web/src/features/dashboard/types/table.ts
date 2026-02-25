export type ColumnAlignment = 'left' | 'center' | 'right';

export interface Column {
  key: string;
  label: string;
  align?: ColumnAlignment;
  formatter?: (value: any) => string | React.ReactNode;
}

export interface DataTableRow {
  key: string;
  [key: string]: any;
}
