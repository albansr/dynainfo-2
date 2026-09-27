import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { startOfMonth, subMonths } from 'date-fns';
import { Button } from '@heroui/react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { PageHeader } from '@/core/components/PageHeader';
import { AnalyticsListSection } from '@/core/components/analytics/AnalyticsListSection';
import type { ColumnDefinition } from '@/core/components/RegionalTable/config/types';
import { textCellRenderer } from '@/core/components/RegionalTable/renderers/cellRenderers';
import type { CustomerPreset } from '@/core/config/customerPresets';

/** Identity-only columns (cédula/NIT + client) for lists with no relevant metrics. */
const CEDULA_COLUMNS: ColumnDefinition[] = [
  {
    id: 'cedula',
    header: { label: 'CÉDULA / NIT', align: 'left', rowSpan: 2 },
    accessor: (d) => d.id,
    cellRenderer: textCellRenderer,
    align: 'left',
    sortable: true,
    sortKey: 'id',
  },
  {
    id: 'cliente',
    header: { label: 'CLIENTE', align: 'left', rowSpan: 2 },
    accessor: (d) => d.name,
    cellRenderer: textCellRenderer,
    align: 'left',
    sortable: true,
    sortKey: 'name',
  },
];

interface PresetView {
  title: string;
  customerPreset: CustomerPreset;
  /** Start of the fixed rolling window (end = now). Ignored when `temporality`. */
  start: (now: Date) => Date;
  /** Identity-only list (cédula + client), no metrics or totals. */
  simple?: boolean;
  /**
   * Keep the global temporality selector. Used by peso: the roster is fixed to
   * 12 months server-side, and the selector only re-reads those clients' figures
   * over the chosen window.
   */
  temporality?: boolean;
  /** Optional header subtitle (e.g. to explain a two-window list). */
  subtitle?: string;
}

const PRESET_VIEWS: Record<string, PresetView> = {
  sin_compra_mes: {
    title: 'Clientes sin compra este mes',
    customerPreset: 'sin_compra',
    start: (now) => startOfMonth(now),
    simple: true,
  },
  sin_compra: {
    title: 'Clientes que se enfriaron (sin compra en 3 meses)',
    customerPreset: 'sin_compra',
    start: (now) => subMonths(now, 3),
    simple: true,
  },
  riesgo: {
    title: 'Clientes en riesgo y cayendo',
    customerPreset: 'riesgo',
    start: (now) => subMonths(now, 12),
  },
  promesa: {
    title: 'Promesas creciendo',
    customerPreset: 'promesa',
    start: (now) => subMonths(now, 12),
  },
  peso: {
    title: 'Clientes clave — el 80% de tus ventas',
    customerPreset: 'peso',
    start: (now) => subMonths(now, 12),
    temporality: true,
    subtitle:
      'Los clientes clave que concentran el 80% de tus ventas de los últimos 12 meses y retroceden frente al año anterior. La temporalidad solo cambia sus cifras, no el listado.',
  },
};

export function EstadoDetailPage() {
  const { preset = '' } = useParams();
  const navigate = useNavigate();
  const view = PRESET_VIEWS[preset];

  // Most details pin their criterion's fixed rolling window; peso keeps the global
  // temporality selector (its roster is fixed to 12 months server-side).
  const dateOverride = useMemo(() => {
    if (!view || view.temporality) return undefined;
    const now = new Date();
    return { startDate: view.start(now), endDate: now, preset: 'current-month' as const };
  }, [view]);

  return (
    <div>
      <PageHeader
        title={view?.title ?? 'Clientes'}
        showDateFilter={!!view?.temporality}
        subtitle={view?.subtitle ?? ''}
      />

      <Button
        variant="light"
        size="sm"
        className="mb-2 cursor-pointer"
        startContent={<ArrowLeftIcon className="h-4 w-4" />}
        onPress={() => navigate('/estado')}
      >
        Volver a Estado
      </Button>

      {!view ? (
        <div className="rounded-xl border border-zinc-200 p-10 text-center text-zinc-500">
          Segmento no encontrado.
        </div>
      ) : (
        <AnalyticsListSection
          groupBy="customer_id"
          customerPreset={view.customerPreset}
          dateOverride={dateOverride}
          reportTitle={view.title}
          showSearch
          dimensionLabel="CLIENTE"
          {...(view.simple ? { tableColumns: CEDULA_COLUMNS, tableColumnGroups: [], hideTotals: true } : {})}
        />
      )}
    </div>
  );
}
