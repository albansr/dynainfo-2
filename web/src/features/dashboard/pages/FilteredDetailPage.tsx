import { useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Breadcrumbs, BreadcrumbItem } from '@heroui/react';
import { DashboardView } from '@/features/dashboard/components/DashboardView';
import { DimensionBreakdown } from '@/core/components/analytics/DimensionBreakdown';
import type { GroupByDimension } from '@/core/api/hooks/useList';
import { ANALYSIS_VIEWS } from '@/core/config/analysisViews';
import {
  ENTITY_DIMS,
  detailUrl,
  getSegmentEntityOptions,
  parseDetailParams,
} from '@/core/config/breakdownDimensions';

/**
 * Generic filtered-detail explorer. All context lives in the URL query params
 * (`v` = origin analysis view, its filters, the drilled dims in order, `g` =
 * current breakdown dimension, `trail` = pipe-separated labels), so drilling
 * survives refresh and is shareable.
 */
export function FilteredDetailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  // Derive from the serialized query so `filters` keeps a stable identity across
  // renders (avoids invalidating child memos/queries needlessly).
  const search = params.toString();
  const { viewId, seed, steps, trail, filters, groupBy } = useMemo(() => parseDetailParams(search), [search]);
  const title = trail[trail.length - 1] ?? '';

  // The first crumb goes back to the view the drill started from. Links made
  // before the view was recorded fall back to the role's default view.
  const originView = ANALYSIS_VIEWS.find((v) => v.id === viewId);

  const breadcrumbs = (
    <Breadcrumbs
      size="sm"
      onAction={(key) => {
        const k = String(key);
        if (k === 'inicio') {
          navigate(originView ? `/dashboard?v=${originView.id}` : '/dashboard');
          return;
        }
        const level = Number(k) + 1;
        navigate(detailUrl({ viewId, seed, steps: steps.slice(0, level), trail: trail.slice(0, level) }));
      }}
    >
      {[
        <BreadcrumbItem key="inicio">{originView?.label ?? 'Análisis'}</BreadcrumbItem>,
        ...trail.map((label, i) => (
          <BreadcrumbItem key={String(i)}>{label}</BreadcrumbItem>
        )),
      ]}
    </Breadcrumbs>
  );

  const onDrill = (dim: GroupByDimension, value: string, name: string) => {
    navigate(detailUrl({ viewId, seed, steps: [...steps, [dim, value]], trail: [...trail, name] }));
  };

  // qube6 segment chart follows the same criteria: default to the context's
  // grouping entity, and hide the "own" entity like the breakdown selector.
  const segmentEntityOptions = getSegmentEntityOptions(filters);
  const segmentDefaultEntity = ENTITY_DIMS.includes(groupBy)
    ? groupBy
    : (segmentEntityOptions[0] ?? 'customer_id');

  return (
    <DashboardView
      title={title}
      breadcrumbs={breadcrumbs}
      filters={filters}
      segmentEntityOptions={segmentEntityOptions}
      segmentDefaultEntity={segmentDefaultEntity}
      footer={
        <DimensionBreakdown
          filters={filters}
          initialGroupBy={groupBy}
          onDrill={onDrill}
          reportTitle={title}
        />
      }
    />
  );
}
