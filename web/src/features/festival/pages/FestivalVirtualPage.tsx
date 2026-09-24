import { useMemo } from 'react';
import { format, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Spinner, SelectItem, Breadcrumbs, BreadcrumbItem } from '@heroui/react';
import { PageHeader } from '@/core/components/PageHeader';
import { AppSelect } from '@/core/components/AppSelect';
import { NavBadge } from '@/core/components/NavBadge';
import { SalesBarChart } from '@/core/components/SalesBarChart';
import { RegionalTable, type RegionalData } from '@/core/components/RegionalTable';
import {
  FESTIVALS,
  getFestival,
  FESTIVAL_DIMENSIONS,
  FESTIVAL_DIM_LABEL,
  FESTIVAL_DEFAULT_GROUP_BY,
} from '../config/festival';
import { DRILL_TARGET } from '@/core/config/drillTarget';
import { FestivalExportButton } from '../components/FestivalExportButton';
import { FestivalMetricsCards } from '../components/FestivalMetricsCards';
import { getFestivalColumns, festivalRowsToRegionalData } from '../config/festivalColumns';
import { useFestivalBalance, useFestivalList, useFestivalDaily } from '../hooks/useFestivalBalance';

const FESTIVAL_PATH = '/festival-virtual';
// URL keys that are not drill filters: current dimension, breadcrumb trail, festival edition.
const RESERVED = new Set(['g', 'trail', 'f']);

function formatRange(start: Date, end: Date): string {
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startLabel = sameMonth ? format(start, 'd', { locale: es }) : format(start, "d 'de' MMMM", { locale: es });
  const endLabel = format(end, "d 'de' MMMM 'de' yyyy", { locale: es });
  return `${startLabel} – ${endLabel}`;
}

export function FestivalVirtualPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const festival = getFestival(params.get('f'));
  const hasComparison = !!(festival.compareStartDate && festival.compareEndDate);
  const range = {
    startDate: festival.startDate,
    endDate: festival.endDate,
    compareStartDate: festival.compareStartDate,
    compareEndDate: festival.compareEndDate,
  };

  // Drill state lives in the URL: dim=value pairs are the accumulated filters,
  // `g` the current listing dimension, `trail` the pipe-separated breadcrumb labels.
  const entries = Array.from(params.entries());
  const drillSteps = entries.filter(([k]) => !RESERVED.has(k));
  const filters = Object.fromEntries(drillSteps);
  const trail = (params.get('trail') ?? '').split('|').filter(Boolean);
  const groupBy = params.get('g') || FESTIVAL_DEFAULT_GROUP_BY;

  const { data, isLoading } = useFestivalBalance(range, filters);
  const { data: listData, isLoading: listLoading } = useFestivalList(range, groupBy, filters);
  const { data: dailyData, isLoading: dailyLoading } = useFestivalDaily(range, filters);
  const b = data?.data;
  const rows = listData?.data ?? [];

  // Every festival day on the axis, zero-filled where there were no sales.
  // budget: 0 → SalesBarChart hides its budget average line.
  const dailySeries = useMemo(() => {
    const byDay = new Map((dailyData?.data ?? []).map((p) => [p.period, p.sales_total]));
    return eachDayOfInterval({ start: festival.startDate, end: festival.endDate }).map((day) => {
      const period = format(day, 'yyyy-MM-dd');
      return { period, sales: byDay.get(period) ?? 0, budget: 0 };
    });
  }, [dailyData, festival.startDate, festival.endDate]);

  // El evento termina al cerrar su último día; desde entonces las tarjetas
  // pasan del "a mismo día" a las cifras completas del festival anterior.
  const eventFinished = new Date(new Date().setHours(0, 0, 0, 0)) > festival.endDate;
  // Referencia acumulada del festival anterior: hasta el día en curso durante
  // el evento; el total completo antes de empezar y al finalizar.
  const useToDateCompare = !eventFinished && !!b && b.current_day > 0;
  const compareDayLabel = useToDateCompare ? `Festival anterior (día ${b!.current_day}):` : 'Festival anterior:';

  const eventRange = formatRange(festival.startDate, festival.endDate);
  const compareRange = hasComparison ? formatRange(festival.compareStartDate!, festival.compareEndDate!) : null;
  const dimLabel = FESTIVAL_DIM_LABEL[groupBy] ?? groupBy;
  // A row is drillable only if its target dimension is not already an applied
  // filter — otherwise product ↔ customer would cycle, overwriting the earlier
  // filter while `trail` keeps growing (breadcrumbs would desync from filters).
  const drillTarget = DRILL_TARGET[groupBy];
  const isDrillable = !!drillTarget && !(drillTarget in filters);

  // Hide dimensions already drilled into (present as a filter) — same as the
  // distribution detail. Keep the current grouping visible so it stays selected.
  const availableDimensions = FESTIVAL_DIMENSIONS.filter(
    (d) => d.key === groupBy || !(d.key in filters)
  );

  const changeFestival = (id: string) => {
    // Switching edition resets the drill context.
    navigate(`${FESTIVAL_PATH}?f=${id}`);
  };

  const changeDimension = (dim: string) => {
    const p = new URLSearchParams(params);
    p.set('g', dim);
    navigate(`${FESTIVAL_PATH}?${p.toString()}`);
  };

  const drillInto = (region: RegionalData) => {
    if (!isDrillable || !region.id) return;
    const p = new URLSearchParams(params);
    // For Marcas, groupBy is `brand_group` and region.id is the bucket
    // (exclusivas/aliadas); the server expands it into ProveedorComercial.
    p.set(groupBy, region.id);
    p.set('g', drillTarget);
    p.set('trail', [...trail, region.name].join('|'));
    navigate(`${FESTIVAL_PATH}?${p.toString()}`);
  };

  /** URL for breadcrumb level `k` (keeps the first k drill steps + festival). */
  const urlForLevel = (k: number): string => {
    const p = new URLSearchParams();
    p.set('f', festival.id);
    const steps = drillSteps.slice(0, k + 1);
    steps.forEach(([d, v]) => p.set(d, v));
    const lastDim = steps[steps.length - 1]?.[0];
    p.set('g', (lastDim && DRILL_TARGET[lastDim]) || FESTIVAL_DEFAULT_GROUP_BY);
    p.set('trail', trail.slice(0, k + 1).join('|'));
    return `${FESTIVAL_PATH}?${p.toString()}`;
  };

  const editionSelector = (
    <AppSelect
      aria-label="Edición del festival"
      size="sm"
      className="w-full sm:w-44"
      selectedKeys={[festival.id]}
      disallowEmptySelection
      onSelectionChange={(keys) => {
        const id = Array.from(keys)[0];
        if (id) changeFestival(String(id));
      }}
    >
      {FESTIVALS.map((f) => (
        <SelectItem key={f.id}>{f.name}</SelectItem>
      ))}
    </AppSelect>
  );

  return (
    <div>
      <PageHeader
        title={trail[trail.length - 1] ?? festival.name}
        showDateFilter={false}
        titleAccessory={<NavBadge type="live" size="md" label="En Vivo Festival Virtual" />}
        subtitle={`${eventRange}${compareRange ? ` · comparativo vs ${compareRange}` : ' · sin comparativa'}`}
        leadingControl={editionSelector}
        breadcrumbs={
          trail.length > 0 ? (
            <Breadcrumbs
              size="sm"
              onAction={(key) => {
                const k = String(key);
                if (k === 'root') navigate(`${FESTIVAL_PATH}?f=${festival.id}`);
                else navigate(urlForLevel(Number(k)));
              }}
            >
              {[
                <BreadcrumbItem key="root">{festival.name}</BreadcrumbItem>,
                ...trail.map((label, i) => <BreadcrumbItem key={String(i)}>{label}</BreadcrumbItem>),
              ]}
            </Breadcrumbs>
          ) : undefined
        }
      />

      <FestivalMetricsCards
        b={b}
        isLoading={isLoading}
        hasComparison={hasComparison}
        eventFinished={eventFinished}
        useToDateCompare={useToDateCompare}
        compareDayLabel={compareDayLabel}
        festival={festival}
        filters={filters}
        trail={trail}
      />

      {/* Ventas diarias del evento */}
      <div className="mt-8 border border-zinc-200 rounded-lg p-4 sm:p-6">
        <SalesBarChart
          series={dailySeries}
          granularity="day"
          title="Ventas diarias del festival (Facturado + comprometido)"
          isLoading={dailyLoading}
        />
      </div>

      {/* Listado con selector de dimensión + drill-down */}
      <div className="mt-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-zinc-600 tracking-wider">
            DETALLE POR {dimLabel.toUpperCase()}
          </h2>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <FestivalExportButton
              startDate={festival.startDate}
              endDate={festival.endDate}
              groupBy={groupBy}
              dimensionLabel={dimLabel}
              filters={filters}
              reportTitle={[festival.name, ...trail].join(' · ')}
              disabled={listLoading || rows.length === 0}
            />
            <AppSelect
              aria-label="Agrupar por"
              label="Agrupar por"
              size="sm"
              className="w-full sm:w-56"
              selectedKeys={[groupBy]}
              disallowEmptySelection
              onSelectionChange={(keys) => {
                const dim = Array.from(keys)[0];
                if (dim) changeDimension(String(dim));
              }}
            >
              {availableDimensions.map((d) => (
                <SelectItem key={d.key}>{d.label}</SelectItem>
              ))}
            </AppSelect>
          </div>
        </div>

        {listLoading ? (
          <div className="flex justify-center py-10"><Spinner label="Cargando..." /></div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-zinc-400 py-6">Sin datos para el evento</div>
        ) : (
          <RegionalTable
            data={festivalRowsToRegionalData(rows)}
            config={{
              currency: '$',
              locale: 'es-CO',
              currentYear: festival.endDate.getFullYear(),
              previousYear: festival.compareEndDate?.getFullYear() ?? festival.endDate.getFullYear(),
            }}
            columns={getFestivalColumns(dimLabel, rows.some((r) => r.presupuesto != null && r.presupuesto > 0), groupBy)}
            columnGroups={[]}
            {...(isDrillable ? { onRowClick: drillInto } : {})}
          />
        )}
      </div>

      <div className="pb-24" />
    </div>
  );
}
