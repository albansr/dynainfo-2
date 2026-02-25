import { Spinner } from '@heroui/react';

export function LoadingSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner size="lg" label="Cargando..." />
    </div>
  );
}
