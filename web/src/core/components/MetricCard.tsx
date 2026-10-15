import { Skeleton } from '@heroui/react';
import type { ReactNode } from 'react';
import { ReportDataButton } from '@/features/support/components/ReportDataButton';

interface MetricCardProps {
  label: ReactNode;
  value: ReactNode;
  description: ReactNode;
  isLoading?: boolean;
  centered?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'text-2xl',
  md: 'text-2xl',
  lg: 'text-3xl',
};

const skeletonSizes = {
  sm: 'h-8',
  md: 'h-8',
  lg: 'h-9',
};

export function MetricCard({
  label,
  value,
  description,
  isLoading = false,
  centered = false,
  size = 'md',
}: MetricCardProps) {
  return (
    <div className={`group flex flex-col justify-center pt-4 sm:pt-0 border-t sm:border-t-0 border-zinc-200 ${centered ? 'sm:text-center' : ''}`}>
      <p className={`flex items-center gap-1 text-xs font-semibold text-zinc-600 tracking-wider mb-3 ${centered ? 'sm:justify-center' : ''}`}>
        {label}
        {typeof label === 'string' && !isLoading && (
          <ReportDataButton metric={label} value={typeof value === 'string' ? value : undefined} />
        )}
      </p>
      {isLoading ? (
        <Skeleton className={`${skeletonSizes[size]} w-32 rounded-lg mb-2 ${centered ? 'sm:mx-auto' : ''}`} />
      ) : (
        <h3 className={`${sizeClasses[size]} font-bold mb-2`}>
          {value}
        </h3>
      )}
      <p className="text-sm text-zinc-600">
        {description}
      </p>
    </div>
  );
}
