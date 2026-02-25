import { memo } from 'react';
import type { ColumnDefinition } from '../config/types';
import type { RegionalData, TableConfig } from '../types';

interface TableRowProps {
  data: RegionalData;
  columns: ColumnDefinition[];
  config: TableConfig;
  isTotal?: boolean;
  onClick?: (data: RegionalData) => void;
}

export const TableRow = memo(function TableRow({
  data,
  columns,
  config,
  isTotal = false,
  onClick,
}: TableRowProps) {
  const rowClass = isTotal
    ? 'border-t-2 border-zinc-300 font-bold'
    : 'hover:bg-zinc-100 even:bg-zinc-50/80';

  const totalStyle = isTotal ? { backgroundColor: '#f8f8f8' } : undefined;

  return (
    <tr
      className={`${rowClass} ${onClick ? 'cursor-pointer' : ''}`}
      style={totalStyle}
      onClick={() => onClick?.(data)}
    >
      {columns.map((column, index) => {
        const value = column.accessor(data);
        const bgColor = column.backgroundColor?.(data, config) || 'transparent';
        const isLast = index === columns.length - 1;

        return (
          <td
            key={column.id}
            className={`${isLast ? '' : 'border-r'} border-b border-zinc-200`}
            style={{ backgroundColor: bgColor }}
          >
            {column.cellRenderer(data, config, value)}
          </td>
        );
      })}
    </tr>
  );
});
