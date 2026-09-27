import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@heroui/react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { PageHeader } from '@/core/components/PageHeader';
import { AnalyticsListSection } from '@/core/components/analytics/AnalyticsListSection';
import type { CustomerPreset } from '@/core/config/customerPresets';

interface PresetView {
  title: string;
  customerPreset: CustomerPreset;
}

const PRESET_VIEWS: Record<string, PresetView> = {
  riesgo: { title: 'Clientes en riesgo', customerPreset: 'riesgo' },
  promesa: { title: 'Clientes en promesa', customerPreset: 'promesa' },
  peso: { title: 'Clientes clave (80% de tus ventas)', customerPreset: 'peso' },
  sin_compra: { title: 'Clientes sin compra este mes', customerPreset: 'sin_compra' },
};

export function EstadoDetailPage() {
  const { preset = '' } = useParams();
  const navigate = useNavigate();
  const view = useMemo(() => PRESET_VIEWS[preset], [preset]);

  return (
    <div>
      <PageHeader title={view?.title ?? 'Clientes'} />

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
          reportTitle={view.title}
          showSearch
          dimensionLabel="CLIENTE"
        />
      )}
    </div>
  );
}
