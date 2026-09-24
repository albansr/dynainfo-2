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

  const totalStyle = isTotal ? { backgroundColor: '#f3f3f3' } : undefined;

  // A clickable row is a real interactive control: focusable + Enter/Space, with
  // a label so screen-reader users can drill in without a mouse.
  const clickable = !!onClick && !isTotal;
  const interactiveProps = clickable
    ? {
        role: 'button' as const,
        tabIndex: 0,
        'aria-label': `Ver detalle de ${data.name}`,
        onClick: () => onClick!(data),
        onKeyDown: (e: React.KeyboardEvent<HTMLTableRowElement>) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick!(data);
          }
        },
      }
    : {};

  return (
    <tr
      className={`${rowClass} ${clickable ? 'cursor-pointer' : ''}`}
      style={totalStyle}
      {...interactiveProps}
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
