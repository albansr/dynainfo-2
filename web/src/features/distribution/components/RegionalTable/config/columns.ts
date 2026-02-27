import type { ColumnDefinition, ColumnGroup } from './types';
import {
  salesCellRenderer,
  complianceCellRenderer,
  marginCellRenderer,
  marginBudgetCellRenderer,
  textCellRenderer
} from '../renderers/cellRenderers';
import {
  budgetBackgroundColor,
  marginBackgroundColor,
  marginBudgetBackgroundColor
  // retainedBackgroundColor - not currently used
} from './backgroundColors';

// Define all columns
export const COLUMN_DEFINITIONS: ColumnDefinition[] = [
  {
    id: 'regional',
    header: {
      label: 'REGIONAL',
      sortable: true,
      align: 'left',
      rowSpan: 2,
    },
    accessor: (data) => data.name,
    cellRenderer: textCellRenderer,
    align: 'left',
    sortable: true,
    sortKey: 'name',
  },
  {
    id: 'sales',
    group: 'billing',
    header: {
      label: 'VENTAS',
      sortable: true,
      align: 'right',
    },
    accessor: (data) => data.sales,
    cellRenderer: salesCellRenderer,
    align: 'right',
    sortable: true,
    sortKey: 'sales',
  },
  {
    id: 'budget',
    group: 'billing',
    header: {
      label: 'PRESUPUESTO',
      sortable: true,
      align: 'right',
    },
    accessor: (data) => data.budget,
    cellRenderer: complianceCellRenderer,
    backgroundColor: budgetBackgroundColor,
    align: 'right',
    sortable: true,
    sortKey: 'budget',
  },
  {
    id: 'margin',
    group: 'margin',
    header: {
      label: 'REAL',
      sortable: true,
      align: 'right',
    },
    accessor: (data) => data.margin,
    cellRenderer: marginCellRenderer,
    backgroundColor: marginBackgroundColor,
    align: 'right',
    sortable: true,
    sortKey: 'margin',
  },
  {
    id: 'marginBudget',
    group: 'margin',
    header: {
      label: 'Presupuesto',
      sortable: true,
      align: 'right',
    },
    accessor: (data) => ({
      budget: data.margin.budget,
      real: data.margin.current,
    }),
    cellRenderer: marginBudgetCellRenderer,
    backgroundColor: marginBudgetBackgroundColor,
    align: 'right',
    sortable: true,
    sortKey: 'marginBudget',
  },
  {
    id: 'retained',
    header: {
      label: 'RET. CARTERA',
      sortable: true,
      align: 'right',
      rowSpan: 2,
    },
    accessor: (data) => data.retained,
    cellRenderer: complianceCellRenderer,
    align: 'right',
    sortable: true,
    sortKey: 'retained',
  },
];

// Define column groups for multi-level headers
export const COLUMN_GROUPS: ColumnGroup[] = [
  {
    id: 'billing',
    label: 'Ventas (Facturación + Comprometido) VS Presupuesto',
    columns: ['sales', 'budget'],
    align: 'center',
  },
  {
    id: 'margin',
    label: 'MARGEN VS PRESUPUESTO',
    columns: ['margin', 'marginBudget'],
    align: 'center',
  },
];

/**
 * Get columns without budget-related columns
 * Filters out 'budget' and 'marginBudget' columns
 * All remaining columns get rowSpan: 2 since there are no column groups
 */
export function getColumnsWithoutBudget(): ColumnDefinition[] {
  return COLUMN_DEFINITIONS
    .filter(col => col.id !== 'budget' && col.id !== 'marginBudget')
    .map(col => {
      // Remove group association and ensure all headers span 2 rows
      if (col.id === 'margin') {
        return {
          ...col,
          group: undefined,
          header: {
            ...col.header,
            label: 'MARGEN',
            rowSpan: 2,
          },
        };
      }

      // All other columns also need rowSpan: 2 when groups are hidden
      return {
        ...col,
        group: undefined,
        header: {
          ...col.header,
          rowSpan: 2,
        },
      };
    });
}

/**
 * Get column groups without budget-related groups
 * Returns empty array to hide all column group headers
 */
export function getColumnGroupsWithoutBudget(): ColumnGroup[] {
  return [];
}
