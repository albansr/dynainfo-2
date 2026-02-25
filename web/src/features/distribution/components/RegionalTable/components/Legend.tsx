import { memo } from 'react';
import type { LegendItem } from '../config/legend';

interface LegendProps {
  items: LegendItem[];
  className?: string;
}

export const Legend = memo(function Legend({ items, className = '' }: LegendProps) {
  return (
    <div className={`flex justify-end gap-3 text-[10px] text-zinc-400 font-medium ${className}`}>
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: item.color }}
          />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
});
