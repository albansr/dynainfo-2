import { formatPercentage } from '@/core/utils/formatters';

interface GrowthIndicatorProps {
  value: number | null | undefined;
}

export function GrowthIndicator({ value }: GrowthIndicatorProps) {
  if (value === null || value === undefined) {
    return <span className="text-gray-500">—</span>;
  }

  const isPositive = value > 0;
  const isNegative = value < 0;

  return (
    <span className={isPositive ? 'text-green-500' : isNegative ? 'text-red-500' : 'text-gray-500'}>
      {isPositive && '↑ +'}
      {isNegative && '↓ '}
      {value === 0 && ''}
      {formatPercentage(Math.abs(value))}%
    </span>
  );
}
