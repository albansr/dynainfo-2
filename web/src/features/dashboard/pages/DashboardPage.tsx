import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SelectItem, SelectSection } from '@heroui/react';
import { Squares2X2Icon } from '@heroicons/react/24/outline';
import { DashboardView } from '../components/DashboardView';
import { PageHeader } from '@/core/components/PageHeader';
import { AppSelect } from '@/core/components/AppSelect';
import { DimensionBreakdown } from '@/core/components/analytics/DimensionBreakdown';
import type { GroupByDimension } from '@/core/api/hooks/useList';
import { buildDetailUrl, DIM_LABEL } from '@/core/config/breakdownDimensions';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { getRoleViewSections, resolveActiveView } from '@/core/config/access';
import { DEFAULT_ANALYSIS_VIEW_ID } from '@/core/config/analysisViews';

/**
 * Home ("Análisis"). A single page that fuses the former report pages with the
 * dashboard overview (metrics + sales trend + qube segment analysis). The view
 * shown is resolved from the role and the `?v=` param: ADMIN/MANAGER and
 * NEW_CHANNELS get a view selector; every other role sees a single role-managed
 * default. Analytics views add a drillable table; "Compañía General" is overview
 * only; "coming soon" modules show a placeholder.
 */
export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const dynaRole = user?.dynaRole;

  const sections = useMemo(() => getRoleViewSections(dynaRole), [dynaRole]);
  const { view: active, hasSelector } = resolveActiveView(dynaRole, searchParams.get('v'));
  const selectedKeys = useMemo(() => [active.id], [active.id]);

  const selector = hasSelector ? (
    <AppSelect
      label="Vista"
      selectedKeys={selectedKeys}
      disallowEmptySelection
      onSelectionChange={(keys) => {
        const key = Array.from(keys)[0] as string | undefined;
        if (key) setSearchParams(key === DEFAULT_ANALYSIS_VIEW_ID ? {} : { v: key });
      }}
      className="w-full"
      startContent={<Squares2X2Icon className="h-4 w-4 text-default-400" />}
    >
      {sections.map((section) => (
        <SelectSection key={section.section} title={section.section} showDivider>
          {section.views.map((view) => (
            <SelectItem key={view.id} className="cursor-pointer">
              {view.label}
            </SelectItem>
          ))}
        </SelectSection>
      ))}
    </AppSelect>
  ) : undefined;

  const chip = active.label;
  const chipMuted = active.id !== DEFAULT_ANALYSIS_VIEW_ID;

  if (active.type === 'soon') {
    return (
      <div>
        <PageHeader title="Análisis" chip={chip} chipMuted={chipMuted} showDateFilter={false} leadingControl={selector} />
        <div className="border border-zinc-200 rounded-lg p-10 flex flex-col items-center justify-center text-center gap-2">
          <span className="text-4xl">🚧</span>
          <h2 className="text-lg font-semibold text-zinc-700">{active.label}</h2>
          <p className="text-sm text-zinc-500">Próximamente</p>
        </div>
      </div>
    );
  }

  const config = active.config!;

  // "Compañía General" is overview only (no table).
  if (active.type === 'overview') {
    return <DashboardView title="Análisis" chip={chip} chipMuted={chipMuted} filters={config.filters} leadingControl={selector} />;
  }

  // The "Agrupar por" selector offers the standard breakdown dims; a view whose
  // native dimension isn't one is added as an extra option so it stays selectable.
  const isStandard = !!DIM_LABEL[config.groupBy];
  const initialGroupBy: GroupByDimension = config.groupBy;
  const extraDims = isStandard
    ? undefined
    : [{ key: config.groupBy, label: config.dimensionLabel ?? config.groupBy }];

  return (
    <DashboardView
      key={active.id}
      title="Análisis"
      chip={chip}
      chipMuted={chipMuted}
      filters={config.filters}
      leadingControl={selector}
      footer={
        <DimensionBreakdown
          filters={config.filters ?? {}}
          initialGroupBy={initialGroupBy}
          extraDims={extraDims}
          totalsLabel={config.totalsLabel}
          hideBudgetColumns={config.hideBudgetColumns ?? false}
          hideRetainedColumn={config.hideRetainedColumn}
          nameOverrides={config.nameOverrides}
          onDrill={(dim, value, name) => navigate(buildDetailUrl(dim, value, name, config.filters ?? {}))}
          reportTitle={config.title}
        />
      }
    />
  );
}
