import type { Column, DataTableRow } from '../types/table';

interface DataTableProps {
  columns: Column[];
  rows: DataTableRow[];
  isLoading?: boolean;
  className?: string;
}

export function DataTable({ columns, rows, isLoading, className = '' }: DataTableProps) {
  if (isLoading) {
    return (
      <div className={`${className} flex items-center justify-center h-64`}>
        <div className="text-zinc-500">Cargando datos...</div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: '1400px' }}>
          <thead style={{ backgroundColor: '#f8f8f8' }}>
            <tr>
              {columns.map((column, index) => {
                const isLast = index === columns.length - 1;
                const isFirst = index === 0;
                const alignClass = column.align === 'left'
                  ? 'ml-2 text-left'
                  : column.align === 'center'
                  ? 'text-center'
                  : 'mr-2 text-right';

                return (
                  <th
                    key={column.key}
                    className={`px-0 py-3 ${isLast ? '' : 'border-r'} border-b border-zinc-200 ${isFirst ? 'whitespace-nowrap' : ''}`}
                    style={isFirst ? { minWidth: '180px' } : { minWidth: '140px' }}
                  >
                    <div className={`${alignClass} text-[10px] font-bold uppercase tracking-wide text-zinc-500 px-4`}>
                      {column.label}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, _rowIndex) => (
              <tr
                key={row.key}
                className="hover:bg-zinc-100 even:bg-zinc-50/80"
              >
                {columns.map((column, colIndex) => {
                  const value = row[column.key];
                  const displayValue = column.formatter ? column.formatter(value) : value;
                  const isLast = colIndex === columns.length - 1;
                  const isFirst = colIndex === 0;
                  const alignClass = column.align === 'left'
                    ? 'text-left'
                    : column.align === 'center'
                    ? 'text-center'
                    : 'text-right';

                  return (
                    <td
                      key={column.key}
                      className={`${isLast ? '' : 'border-r'} border-b border-zinc-200 ${isFirst ? 'whitespace-nowrap' : ''}`}
                    >
                      <div className={`px-4 ${alignClass} py-2.5`}>
                        <div className="text-[13px] text-zinc-900 whitespace-nowrap">
                          {displayValue}
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
