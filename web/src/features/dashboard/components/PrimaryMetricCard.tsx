import { Skeleton } from '@heroui/react';
import type { ReactNode } from 'react';

interface PrimaryMetricCardProps {
  label: string;
  mainValue: ReactNode;
  secondaryLabel: string;
  secondaryValue: ReactNode;
  isLoading?: boolean;
}

export function PrimaryMetricCard({
  label,
  mainValue,
  secondaryLabel,
  secondaryValue,
  isLoading = false,
}: PrimaryMetricCardProps) {
  return (
    <div className="col-span-2 flex flex-col justify-center border-r border-gray-200 pr-8">
      <p className="text-xs font-semibold text-gray-600 tracking-wider mb-4">
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
        <p className="text-sm text-gray-600">
          {secondaryLabel} {secondaryValue}
        </p>
      )}
    </div>
  );
}
