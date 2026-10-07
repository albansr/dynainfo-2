import type { ReactNode } from 'react';
import { Tooltip } from '@heroui/react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { PrimaryMetricCard } from '@/core/components/PrimaryMetricCard';
import { MetricCard } from '@/core/components/MetricCard';

export interface ReachValues {
  /** Items: distinct products sold. */
  productos_unicos: number;
  /** Numérica: distinct customers served. */
  clientes_unicos: number;
  clientes_sin_compra: number;
}

interface ReachMetricsBlockProps {
  reach: ReachValues | undefined;
  isLoading: boolean;
  /** How "sin compra" is defined on this board (tooltip next to the label). */
  sinCompraTooltip: string;
  /** Short context under the "sin compra" value. */
  sinCompraDescription: string;
  /** Detail trigger rendered next to the "sin compra" value (e.g. SinCompraModal). */
  sinCompraDetail: ReactNode;
}

const count = (value: number | undefined) => (value ?? 0).toLocaleString('es-CO');

/**
 * Reach block shared by Festival Virtual and the analysis boards: ITEMS,
 * NUMÉRICA and CLIENTES SIN COMPRA (with its detail). Each board passes its own
 * data and its own definition of "sin compra".
 */
export function ReachMetricsBlock({
  reach,
  isLoading,
  sinCompraTooltip,
  sinCompraDescription,
  sinCompraDetail,
}: ReachMetricsBlockProps) {
  return (
    <div className="mt-8 border border-zinc-200 rounded-lg p-4 sm:p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
        <PrimaryMetricCard
          label="ITEMS"
          mainValue={count(reach?.productos_unicos)}
          secondaryLabel="Productos únicos vendidos"
          secondaryValue=""
          isLoading={isLoading}
        />
        <MetricCard
          label="NUMÉRICA"
          value={count(reach?.clientes_unicos)}
          description="Clientes únicos atendidos"
          isLoading={isLoading}
          centered
        />
        <MetricCard
          label={
            <span className="inline-flex items-center gap-1">
              CLIENTES SIN COMPRA
              <Tooltip placement="top" className="max-w-72" content={sinCompraTooltip}>
                <InformationCircleIcon className="h-4 w-4 text-zinc-400" />
              </Tooltip>
            </span>
          }
          value={
            <span className="inline-flex items-center gap-1.5">
              {count(reach?.clientes_sin_compra)}
              {sinCompraDetail}
            </span>
          }
          description={sinCompraDescription}
          isLoading={isLoading}
          centered
        />
      </div>
    </div>
  );
}
