import { toast } from 'sonner';
import { PageHeader } from '@/core/components/PageHeader';

export function SettingsPage() {
  return (
    <div>
      <PageHeader title="Configuración" showDateFilter={false} />

      <div className="border border-gray-200 rounded-lg p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Presupuesto</h2>
        <p className="text-xs text-zinc-500 mb-4">
          Recarga los datos de presupuesto desde la fuente de datos. Úsalo cuando se hayan
          actualizado los archivos de presupuesto y quieras reflejar los cambios en los informes.
        </p>
        <button
          className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors cursor-pointer"
          onClick={() =>
            toast('Se ha iniciado la tarea, en unos minutos se recargará el presupuesto')
          }
        >
          Recargar presupuesto
        </button>
      </div>
    </div>
  );
}
