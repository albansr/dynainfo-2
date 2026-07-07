import { useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Breadcrumbs, BreadcrumbItem } from '@heroui/react';
import { DashboardView } from '@/features/dashboard/components/DashboardView';
import { DimensionBreakdown } from '../components/DimensionBreakdown';
import type { GroupByDimension } from '@/core/api/hooks/useList';
import {
  DETAIL_PATH,
  DRILL_TARGET,
  ENTITY_DIMS,
  getBreakdownDefault,
  getSegmentEntityOptions,
} from '../config/breakdownDimensions';

const RESERVED = new Set(['g', 'trail']);

/**
 * Generic filtered-detail explorer. All context lives in the URL query params
 * (channel + drilled dims in order, `g` = current breakdown dimension,
 * `trail` = pipe-separated labels), so drilling survives refresh and is shareable.
 */
export function FilteredDetailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const entries = Array.from(params.entries());
  // Ordered drill steps: [dim, value] excluding channel and reserved keys
  const drillSteps = entries.filter(([k]) => !RESERVED.has(k) && k !== 'channel');
  const filters = Object.fromEntries(entries.filter(([k]) => !RESERVED.has(k)));
  const trail = (params.get('trail') ?? '').split('|').filter(Boolean);
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
