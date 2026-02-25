import { useMemo } from 'react';
import { TableHeader } from './components/TableHeader';
import { TableRow } from './components/TableRow';
import { useSort } from './hooks/useSort';
import { COLUMN_DEFINITIONS, COLUMN_GROUPS } from './config/columns';
import { DEFAULT_THRESHOLDS } from './constants';
import type { RegionalData, TableConfig } from './types';
import type { ColumnDefinition, ColumnGroup } from './config/types';

interface RegionalTableProps {
  data: RegionalData[];
  totals?: RegionalData;
  config: TableConfig;
  className?: string;
  onRowClick?: (region: RegionalData) => void;
  // Allow column customization
  columns?: ColumnDefinition[];
  columnGroups?: ColumnGroup[];
}

export function RegionalTable({
  data,
  totals,
  config,
  className = '',
  onRowClick,
  columns = COLUMN_DEFINITIONS,
  columnGroups = COLUMN_GROUPS,
}: RegionalTableProps) {
  const { sortedData, sortKey, sortDirection, handleSort } = useSort(data, columns);

  // Merge default thresholds with config
  const fullConfig = useMemo(
    () => ({
      ...config,
      thresholds: config.thresholds || DEFAULT_THRESHOLDS,
    }),
    [config]
  );

  return (
    <div className={className}>
      {/* Table */}
      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
        <table className="w-full border-collapse">
          <TableHeader
            columns={columns}
            groups={columnGroups}
            config={fullConfig}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
          />

          <tbody>
            {sortedData.map((region) => (
              <TableRow
                key={region.id}
                data={region}
                columns={columns}
                config={fullConfig}
                onClick={onRowClick}
              />
            ))}

            {totals && (
              <TableRow
                key="totals"
                data={totals}
                columns={columns}
                config={fullConfig}
                isTotal
              />
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
