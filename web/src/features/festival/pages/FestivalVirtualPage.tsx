import { useMemo, useState, type ReactNode } from 'react';
import { format, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Spinner, Select, SelectItem, Breadcrumbs, BreadcrumbItem, Tooltip } from '@heroui/react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { NavBadge } from '@/core/components/NavBadge';
import { PrimaryMetricCard } from '@/features/dashboard/components/PrimaryMetricCard';
import { MetricCard } from '@/features/dashboard/components/MetricCard';
import { SalesBarChart } from '@/features/dashboard/components/SalesBarChart';
import { RegionalTable, type RegionalData } from '@/features/distribution/components/RegionalTable';
import { formatCurrency, formatPercentage, formatPercentageWithSign } from '@/core/utils/formatters';
import {
  FESTIVALS,
  getFestival,
  FESTIVAL_DIMENSIONS,
  FESTIVAL_DIM_LABEL,
  FESTIVAL_DRILL_TARGET,
  FESTIVAL_DEFAULT_GROUP_BY,
  FESTIVAL_ACCESS_CODE,
  FESTIVAL_ACCESS_STORAGE_KEY,
} from '../config/festival';
import { FestivalTeaser } from '../components/FestivalTeaser';
import { FestivalExportButton } from '../components/FestivalExportButton';
import { FestivalSinCompraModal } from '../components/FestivalSinCompraModal';
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

/** Signed, color-coded growth value; N/A when there is no comparison base. */
function growth(value: number | null): ReactNode {
  if (value === null || !Number.isFinite(value)) {
    return <span className="text-gray-500">N/A</span>;
  }
  return (
    <span className={value >= 0 ? 'text-green-600' : 'text-red-600'}>
      {formatPercentageWithSign(value)}%
    </span>
  );
}

/**
 * Validation gate: while FESTIVAL_ACCESS_CODE is set, visitors see the FV2
 * teaser and only reviewers with the code reach the dashboard. Setting the
 * code to null in config/festival.ts removes the gate entirely.
 */
export function FestivalVirtualPage() {
  const [unlocked, setUnlocked] = useState(
    () =>
      FESTIVAL_ACCESS_CODE === null ||
      localStorage.getItem(FESTIVAL_ACCESS_STORAGE_KEY) === FESTIVAL_ACCESS_CODE
  );

  if (!unlocked) {
    return <FestivalTeaser onUnlock={() => setUnlocked(true)} />;
  }

  return <FestivalDashboard />;
}

function FestivalDashboard() {
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
  const drillTarget = FESTIVAL_DRILL_TARGET[groupBy];
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
    p.set('g', (lastDim && FESTIVAL_DRILL_TARGET[lastDim]) || FESTIVAL_DEFAULT_GROUP_BY);
    p.set('trail', trail.slice(0, k + 1).join('|'));
    return `${FESTIVAL_PATH}?${p.toString()}`;
  };

  return (
    <div>
      {/* Header */}
      <div className="sticky -top-4 z-10 bg-white -mx-4 xl:-mx-10 px-4 xl:px-10 -mt-4 pt-4 pb-4 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            {trail.length > 0 && (
              <Breadcrumbs
                size="sm"
                className="mb-1"
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
            )}
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">
                {trail[trail.length - 1] ?? festival.name}
              </h1>
              <NavBadge type="live" size="md" label="En Vivo Festival Virtual" />
            </div>
            <p className="text-sm text-zinc-500 mt-1">
              {eventRange}
              {compareRange ? ` · comparativo vs ${compareRange}` : ' · sin comparativa'}
            </p>
          </div>

          {/* Selector de edición del festival (arriba a la derecha) */}
          <Select
            aria-label="Edición del festival"
            size="sm"
            className="w-44 shrink-0"
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
          </Select>
        </div>
      </div>

      {/* Ventas del evento (métrica principal) */}
      <div className="border border-gray-200 rounded-lg p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          <PrimaryMetricCard
            label="VENTAS (Facturado + comprometido)"
            mainValue={`$ ${b ? formatCurrency(b.sales_total) : '0'}`}
            secondaryLabel={compareDayLabel}
            secondaryValue={(() => {
              const value = useToDateCompare ? b!.sales_total_compare_to_date : b?.sales_total_compare;
              return value != null ? `$ ${formatCurrency(value)}` : 'N/A';
            })()}
            isLoading={isLoading}
          />
          <MetricCard
            label={eventFinished ? 'CRECIMIENTO DE VENTAS' : 'CRECIMIENTO A MISMO DÍA'}
            value={b ? growth(eventFinished ? b.sales_total_growth : b.sales_total_growth_to_date) : <span>0%</span>}
            description={
              eventFinished
                ? 'vs festival anterior completo'
                : b && b.to_date_days > 0
                  ? `Días 1–${b.to_date_days} de ${b.event_days} vs festival anterior`
                  : 'Disponible al cierre del día 1'
            }
            isLoading={isLoading}
            centered
          />
          {b?.cumplimiento_ppto != null && (
            <MetricCard
              label="CUMPLIMIENTO PRESUPUESTO"
              value={
                <span className={b.cumplimiento_ppto >= 100 ? 'text-green-600' : 'text-red-600'}>
                  {formatPercentage(b.cumplimiento_ppto)}%
                </span>
              }
              description={
                !eventFinished && b.current_day > 0 && b.presupuesto_meta != null && b.presupuesto != null && b.presupuesto_meta < b.presupuesto
                  ? `Meta día ${b.current_day}: $ ${formatCurrency(b.presupuesto_meta)}`
                  : `Presupuesto: $ ${formatCurrency(b.presupuesto ?? 0)}`
              }
              isLoading={isLoading}
              centered
            />
          )}
        </div>
      </div>

      {/* Margen Total / Margen Recuperado (rappel) / evolutivo */}
      <div className="mt-8 border border-gray-200 rounded-lg p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          <PrimaryMetricCard
            label="MARGEN TOTAL (Margen + Margen Recuperado)"
            mainValue={`${b ? formatPercentage(b.margen_rappel_pct) : '0'}%`}
            secondaryLabel={compareDayLabel}
            secondaryValue={(() => {
              const value = useToDateCompare ? b!.margen_rappel_pct_compare_to_date : b?.margen_rappel_pct_compare;
              return value != null ? `${formatPercentage(value)}%` : 'N/A';
            })()}
            isLoading={isLoading}
          />
          <MetricCard
            label={eventFinished ? 'VARIACIÓN DEL MARGEN TOTAL' : 'VAR. MARGEN A MISMO DÍA'}
            value={b ? growth(eventFinished ? b.margen_rappel_pct_growth : b.margen_rappel_pct_growth_to_date) : <span>0%</span>}
            description={
              eventFinished
                ? 'vs festival anterior completo'
                : b && b.to_date_days > 0
                  ? `Días 1–${b.to_date_days} de ${b.event_days} vs festival anterior`
                  : 'Disponible al cierre del día 1'
            }
            isLoading={isLoading}
            centered
          />
          <MetricCard
            label="MARGEN RECUPERADO"
            value={`${b ? formatPercentageWithSign(b.rappel_pct) : '+0'}%`}
            description={`Suma al margen de ${b ? formatPercentage(b.gross_margin_pct) : '0'}%`}
            isLoading={isLoading}
            centered
          />
        </div>
      </div>

      {/* Pedidos: comprometido y pedido promedio */}
      <div className="mt-8 border border-gray-200 rounded-lg p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          <PrimaryMetricCard
            label="COMPROMETIDO"
            mainValue={`$ ${b ? formatCurrency(b.comprometido) : '0'}`}
            secondaryLabel="Valor de pedidos pendientes de facturar"
            secondaryValue=""
            isLoading={isLoading}
          />
          <MetricCard
            label="PEDIDO PROMEDIO"
            value={`$ ${b ? formatCurrency(b.pedido_promedio) : '0'}`}
            description={
              hasComparison
                ? `Comparativo: ${b?.pedido_promedio_compare != null ? `$ ${formatCurrency(b.pedido_promedio_compare)}` : 'N/A'}`
                : 'Sin comparativa'
            }
            isLoading={isLoading}
            centered
          />
        </div>
      </div>

      {/* Alcance del evento: items (productos únicos), numérica (clientes únicos)
          y clientes sin compra (activos del año que no han comprado en el festival) */}
      <div className="mt-8 border border-gray-200 rounded-lg p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          <PrimaryMetricCard
            label="ITEMS"
            mainValue={(b?.productos_unicos ?? 0).toLocaleString('es-CO')}
            secondaryLabel="Productos únicos vendidos"
            secondaryValue=""
            isLoading={isLoading}
          />
          <MetricCard
            label="NUMÉRICA"
            value={(b?.clientes_unicos ?? 0).toLocaleString('es-CO')}
            description="Clientes únicos atendidos"
            isLoading={isLoading}
            centered
          />
          <MetricCard
            label={
              <span className="inline-flex items-center gap-1">
                CLIENTES SIN COMPRA
                <Tooltip
                  placement="top"
                  className="max-w-72"
                  content={`Clientes activos que han comprado en ${festival.startDate.getFullYear()} pero no han comprado durante el festival. El detalle muestra el vendedor de su última compra del año.`}
                >
                  <InformationCircleIcon className="h-4 w-4 text-gray-400" />
                </Tooltip>
              </span>
            }
            value={
              <span className="inline-flex items-center gap-1.5">
                {(b?.clientes_sin_compra ?? 0).toLocaleString('es-CO')}
                <FestivalSinCompraModal
                  startDate={festival.startDate}
                  endDate={festival.endDate}
                  filters={filters}
                  reportTitle={[festival.name, ...trail].join(' · ')}
                />
              </span>
            }
            description="Durante el festival"
            isLoading={isLoading}
            centered
          />
        </div>
      </div>

      {/* Ventas diarias del evento */}
      <div className="mt-8 border border-gray-200 rounded-lg p-4 sm:p-6">
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
          <h2 className="text-sm font-semibold text-gray-600 tracking-wider">
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
            <Select
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
            </Select>
          </div>
        </div>

        {listLoading ? (
          <div className="flex justify-center py-10"><Spinner label="Cargando..." /></div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-gray-400 py-6">Sin datos para el evento</div>
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
