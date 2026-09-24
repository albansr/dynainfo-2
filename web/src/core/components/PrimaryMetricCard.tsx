import { Skeleton } from '@heroui/react';
import type { ReactNode } from 'react';

interface PrimaryMetricCardProps {
  label: string;
  mainValue: ReactNode;
  secondaryLabel: string;
  secondaryValue: ReactNode;
  /** Optional extra line shown under the main value (e.g. comprometido breakdown). */
  extra?: ReactNode;
  isLoading?: boolean;
}

export function PrimaryMetricCard({
  label,
  mainValue,
  secondaryLabel,
  secondaryValue,
  extra,
  isLoading = false,
}: PrimaryMetricCardProps) {
  return (
    <div className="col-span-1 lg:col-span-2 flex flex-col justify-center sm:border-r border-zinc-200 sm:pr-8">
      <p className="text-xs font-semibold text-zinc-600 tracking-wider mb-4">
        {label}
      </p>
      {isLoading ? (
        <Skeleton className="h-8 w-48 rounded-lg mb-3" />
      ) : (
        <h2 className="text-2xl font-bold mb-3">
          {mainValue}
        </h2>
      )}
      {isLoading ? (
        <Skeleton className="h-5 w-32 rounded-lg" />
      ) : (
        <p className="text-sm text-zinc-600">
          {secondaryLabel} {secondaryValue}
        </p>
      )}
      {!isLoading && extra && (
        <div className="mt-2 pt-2 border-t border-zinc-100">{extra}</div>
      )}
    </div>
  );
}
