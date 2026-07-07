import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDateRange } from '@/core/hooks/useDateRange';
import { useBalance } from '@/core/api/hooks/useBalance';
import { StandardMetrics } from './presets/standardMetrics';
import { PageHeader } from '@/core/components/PageHeader';
import { AnalyticsListSection } from './AnalyticsListSection';
import type { RegionalData } from '@/features/distribution/components/RegionalTable';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { getRoleChannelLabel } from '@/core/config/access';
import { buildDetailUrl } from '@/features/distribution/config/breakdownDimensions';
import type { AnalyticsPageConfig } from './types';

/**
 * Generic Analytics Page — page header + optional metric cards + the shared
 * analytics list section (table, search, export, pagination, totals).
 */
export function AnalyticsPage({
  title,
  groupBy,
  totalsLabel = 'TOTAL:',
  filters,
  metricsPreset = 'standard',
  tableColumns,
  tableColumnGroups,
  hideBudgetColumns = false,
  hideRetainedColumn = false,
  nameOverrides,
  hideMetrics = false,
  showIdInName = false,
  dimensionLabel,
  pageSize = 50,
  showSearch = false,
  detailBasePath,
  drillToDetail = false,
  breadcrumbs,
  enableFilters = false,
  filterContext,
}: AnalyticsPageConfig) {
  const { startDate, endDate, preset } = useDateRange();
  const { user } = useAuth();
  const navigate = useNavigate();
  const channelLabel = getRoleChannelLabel(user?.dynaRole);

  // Clickable rows: drill into the generic detail explorer, or a fixed base path
  const onRowClick = useMemo(
    () => {
      if (drillToDetail) {
        return (row: RegionalData) => navigate(buildDetailUrl(groupBy, row.id, row.name));
      }
      if (detailBasePath) {
        return (row: RegionalData) =>
          navigate(`${detailBasePath}/${encodeURIComponent(row.id)}`, { state: { name: row.name } });
      }
      return undefined;
    },
    [drillToDetail, detailBasePath, groupBy, navigate]
  );

  // Balance for the top metric cards (deduped with the list section's balance query)
  const showMetrics = !hideMetrics && metricsPreset === 'standard';
  const { data: balance, isLoading: isLoadingBalance } = useBalance(startDate, endDate, preset, filters);

  return (
    <div>
      <PageHeader title={title} chip={channelLabel ? `Canal ${channelLabel}` : undefined} breadcrumbs={breadcrumbs} />

      {showMetrics && (
        <StandardMetrics
          balanceData={balance?.data}
          endDate={endDate}
          preset={preset}
          isLoading={isLoadingBalance}
        />
      )}

      <AnalyticsListSection
        groupBy={groupBy}
        filters={filters}
        totalsLabel={totalsLabel}
        tableColumns={tableColumns}
        tableColumnGroups={tableColumnGroups}
        hideBudgetColumns={hideBudgetColumns}
        hideRetainedColumn={hideRetainedColumn}
        nameOverrides={nameOverrides}
        showIdInName={showIdInName}
        dimensionLabel={dimensionLabel}
        pageSize={pageSize}
        showSearch={showSearch}
        onRowClick={onRowClick}
        reportTitle={title}
        enableFilters={enableFilters}
        filterContext={filterContext}
      />
    </div>
  );
}
