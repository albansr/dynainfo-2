import { PageHeader } from '@/core/components/PageHeader';

export function VeraPage() {
  return (
    <div>
      <PageHeader title="Compañía Vinculada / Vera" showDateFilter={false} />
      <div className="flex items-center justify-center h-64">
        <p className="text-xl text-zinc-400 font-medium">Próximamente</p>
      </div>
    </div>
  );
}
