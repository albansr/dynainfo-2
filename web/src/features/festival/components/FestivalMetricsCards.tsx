import type { ReactNode } from 'react';
import { Tooltip } from '@heroui/react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { PrimaryMetricCard } from '@/core/components/PrimaryMetricCard';
import { MetricCard } from '@/core/components/MetricCard';
import { formatCurrency, formatPercentage, formatPercentageWithSign } from '@/core/utils/formatters';
import type { FilterMap } from '@/core/api/downloadExcel';
import { FestivalSinCompraModal } from './FestivalSinCompraModal';
import type { getFestival } from '../config/festival';
import type { useFestivalBalance } from '../hooks/useFestivalBalance';

type Festival = ReturnType<typeof getFestival>;
type Balance = NonNullable<ReturnType<typeof useFestivalBalance>['data']>['data'];

interface FestivalMetricsCardsProps {
  b: Balance | undefined;
  isLoading: boolean;
  hasComparison: boolean;
  eventFinished: boolean;
  /** Compare against the previous festival up to the current day (vs. its total). */
  useToDateCompare: boolean;
  compareDayLabel: string;
  festival: Festival;
  filters: FilterMap;
  /** Breadcrumb trail, used to title the "sin compra" export/report. */
  trail: string[];
}

/** Signed, color-coded growth value; N/A when there is no comparison base. */
function growth(value: number | null): ReactNode {
  if (value === null || !Number.isFinite(value)) {
    return <span className="text-zinc-500">N/A</span>;
  }
  return (
    <span className={value >= 0 ? 'text-green-600' : 'text-red-600'}>
      {formatPercentageWithSign(value)}%
    </span>
  );
}

/**
 * The four festival metric blocks (ventas, margen, pedidos, alcance). Split out
 * of the page so the page stays focused on drill state and layout.
 */
export function FestivalMetricsCards({
  b,
  isLoading,
  hasComparison,
  eventFinished,
  useToDateCompare,
  compareDayLabel,
  festival,
  filters,
  trail,
}: FestivalMetricsCardsProps) {
  return (
    <>
      {/* Ventas del evento (métrica principal) */}
      <div className="border border-zinc-200 rounded-lg p-4 sm:p-6">
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
              description={`Presupuesto: $ ${formatCurrency(b.presupuesto ?? 0)}`}
              isLoading={isLoading}
              centered
            />
          )}
        </div>
      </div>

      {/* Margen Total / Margen Recuperado (rappel) / evolutivo */}
      <div className="mt-8 border border-zinc-200 rounded-lg p-4 sm:p-6">
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
      <div className="mt-8 border border-zinc-200 rounded-lg p-4 sm:p-6">
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
      <div className="mt-8 border border-zinc-200 rounded-lg p-4 sm:p-6">
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
                  content="Clientes activos y no bloqueados del maestro comercial (regionales de venta) que no han comprado durante el festival. El detalle muestra el vendedor asignado a cada cliente."
                >
                  <InformationCircleIcon className="h-4 w-4 text-zinc-400" />
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
    </>
  );
}
