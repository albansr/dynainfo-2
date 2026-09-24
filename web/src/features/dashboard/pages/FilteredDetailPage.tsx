import { useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Breadcrumbs, BreadcrumbItem } from '@heroui/react';
import { DashboardView } from '@/features/dashboard/components/DashboardView';
import { DimensionBreakdown } from '@/core/components/analytics/DimensionBreakdown';
import type { GroupByDimension } from '@/core/api/hooks/useList';
import {
  DETAIL_PATH,
  DRILL_TARGET,
  ENTITY_DIMS,
  getBreakdownDefault,
  getSegmentEntityOptions,
} from '@/core/config/breakdownDimensions';

const RESERVED = new Set(['g', 'trail']);

/**
 * Generic filtered-detail explorer. All context lives in the URL query params
 * (channel + drilled dims in order, `g` = current breakdown dimension,
 * `trail` = pipe-separated labels), so drilling survives refresh and is shareable.
 */
export function FilteredDetailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  // Derive from the URL once per query-string change so `filters` keeps a stable
  // identity across renders (avoids invalidating child memos/queries needlessly).
  // Rebuild from the serialized string so each memo depends only on `search`:
  // the URL query is the single source of truth and `filters` keeps a stable
  // identity across renders (avoids invalidating child memos/queries needlessly).
  const search = params.toString();
  const entries = useMemo(() => Array.from(new URLSearchParams(search).entries()), [search]);
  // Ordered drill steps: [dim, value] excluding channel and reserved keys
  const drillSteps = useMemo(() => entries.filter(([k]) => !RESERVED.has(k) && k !== 'channel'), [entries]);
  const filters = useMemo(() => Object.fromEntries(entries.filter(([k]) => !RESERVED.has(k))), [entries]);
  const trail = useMemo(() => (new URLSearchParams(search).get('trail') ?? '').split('|').filter(Boolean), [search]);
  const initialGroupBy = (params.get('g') as GroupByDimension) || getBreakdownDefault(filters);
  const title = trail[trail.length - 1] ?? '';

  const channel = params.get('channel') ?? 'DISTRIBUCION';

  /** URL for the breadcrumb level `k` (first k drill steps). */
  const urlForLevel = (k: number): string => {
    const p = new URLSearchParams();
    p.set('channel', channel);
    const steps = drillSteps.slice(0, k + 1);
    steps.forEach(([d, v]) => p.set(d, v));
    const lastDim = steps[steps.length - 1]?.[0];
    p.set('g', (lastDim && DRILL_TARGET[lastDim]) || 'customer_id');
    p.set('trail', trail.slice(0, k + 1).join('|'));
    return `${DETAIL_PATH}?${p.toString()}`;
  };

  const breadcrumbs = useMemo(
    () => (
      <Breadcrumbs
        size="sm"
        onAction={(key) => {
          const k = String(key);
          if (k === 'inicio') navigate('/dashboard');
          else navigate(urlForLevel(Number(k)));
        }}
      >
        {[
          <BreadcrumbItem key="inicio">Distribución</BreadcrumbItem>,
          ...trail.map((label, i) => (
            <BreadcrumbItem key={String(i)}>{label}</BreadcrumbItem>
          )),
        ]}
      </Breadcrumbs>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trail.join('|'), drillSteps.map((s) => s.join('=')).join('&')]
  );

  const onDrill = (dim: GroupByDimension, value: string, name: string) => {
    const p = new URLSearchParams(params);
    p.set(dim, value);
    p.set('g', DRILL_TARGET[dim] ?? 'customer_id');
    p.set('trail', [...trail, name].join('|'));
    navigate(`${DETAIL_PATH}?${p.toString()}`);
  };

  // qube6 segment chart follows the same criteria: default to the context's
  // grouping entity, and hide the "own" entity like the breakdown selector.
  const segmentEntityOptions = getSegmentEntityOptions(filters);
  const segmentDefaultEntity = ENTITY_DIMS.includes(initialGroupBy)
    ? initialGroupBy
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
          initialGroupBy={initialGroupBy}
          onDrill={onDrill}
          reportTitle={title}
        />
      }
    />
  );
}
