import { Skeleton } from '@heroui/react';
import type { ReactNode } from 'react';

interface MetricCardProps {
  label: string;
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
    <div className={`flex flex-col justify-center ${centered ? 'text-center' : ''}`}>
      <p className="text-xs font-semibold text-gray-600 tracking-wider mb-3">
        {label}
      </p>
      {isLoading ? (
        <Skeleton className={`${skeletonSizes[size]} w-32 rounded-lg mb-2 ${centered ? 'mx-auto' : ''}`} />
      ) : (
        <h3 className={`${sizeClasses[size]} font-bold mb-2`}>
          {value}
        </h3>
      )}
      <p className="text-sm text-gray-600">
        {description}
      </p>
    </div>
  );
}
