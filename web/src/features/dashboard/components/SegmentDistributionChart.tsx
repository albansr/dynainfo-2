import { useState, useRef, useCallback, useEffect } from 'react';
import type { FilterMap } from '@/core/api/downloadExcel';
import { SelectItem, Tabs, Tab, Skeleton } from '@heroui/react';
import { AppSelect } from '@/core/components/AppSelect';
import { useDateRange } from '@/core/hooks/useDateRange';
import { useQube6Distribution } from '@/core/api/hooks/useQube6Distribution';
import type { AnalysisType, SegmentDistributionItem } from '@/core/api/types';
import { formatCurrency } from '@/core/utils/formatters';

const ANALYSIS_OPTIONS: { key: AnalysisType; label: string }[] = [
  { key: 'value', label: 'Análisis de Valor' },
  { key: 'sales', label: 'Análisis de Ventas' },
  { key: 'profit', label: 'Análisis de Margen' },
  { key: 'quality', label: 'Análisis de Calidad' },
];

const ENTITY_OPTIONS = [
  { key: 'customer_id', label: 'Clientes' },
  { key: 'product_id', label: 'Productos' },
  { key: 'seller_id', label: 'Vendedores' },
] as const;

const SEGMENT_ORDER: Record<AnalysisType, string[]> = {
  value: ['Estrella', 'Volumen', 'Margen', 'Duda'],
  sales: ['Top', 'Promesa', 'Riesgo', 'Coste', 'Nuevo'],
  profit: ['Alta', 'Media', 'Baja'],
  quality: ['Óptima', 'De producto', 'De precio', 'Pésima'],
};

// Soft warm palette: muted amber/sand → neutral (no reds)
const SEGMENT_COLORS: Record<string, string> = {
  // Value
  Estrella: '#b08d57',
  Volumen: '#d4b483',
  Margen: '#e8d5b7',
  Duda: '#e5e7eb',
  // Sales
  Top: '#b08d57',
  Promesa: '#d4b483',
  Riesgo: '#e8d5b7',
  Coste: '#e5e7eb',
  Nuevo: '#a5b4c8',
  // Profit
  Alta: '#b08d57',
  Media: '#d4b483',
  Baja: '#e5e7eb',
  // Quality
  'Óptima': '#b08d57',
  'De producto': '#d4b483',
  'De precio': '#e8d5b7',
  'Pésima': '#e5e7eb',
};

const LIGHT_BG_COLORS = new Set(['#e5e7eb', '#e8d5b7', '#a5b4c8']);

function getTextColor(bgColor: string): string {
  return LIGHT_BG_COLORS.has(bgColor) ? '#374151' : '#ffffff';
}

interface TooltipData {
  name: string;
  metricValue: number;
  metricPct: number;
  x: number;
  y: number;
}

function sortSegments(items: SegmentDistributionItem[], analysisType: AnalysisType): SegmentDistributionItem[] {
  const order = SEGMENT_ORDER[analysisType];
  const map = new Map(items.map((item) => [item.short, item]));
  const sorted: SegmentDistributionItem[] = [];
  for (const name of order) {
    const item = map.get(name);
    if (item) sorted.push(item);
  }
  return sorted;
}

interface StackedBarProps {
  label: string;
  items: SegmentDistributionItem[];
  total: number;
  metric: 'count' | 'sales';
  analysisType: AnalysisType;
  showMarginBadge?: boolean;
}

function StackedBar({ label, items, total, metric, analysisType, showMarginBadge }: StackedBarProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [animated, setAnimated] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  const sorted = sortSegments(items, analysisType);

  // Replay the grow animation whenever the data changes: reset the flag during
  // render (state reset on a data change, not in an effect), then let the effect
  // flip it back on after paint via requestAnimationFrame.
  const [prevItems, setPrevItems] = useState(items);
  const [prevTotal, setPrevTotal] = useState(total);
  if (items !== prevItems || total !== prevTotal) {
    setPrevItems(items);
    setPrevTotal(total);
    setAnimated(false);
  }

  useEffect(() => {
    if (animated) return;
    const frame = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(frame);
  }, [animated]);

  const handleMouseMove = useCallback((e: React.MouseEvent, item: SegmentDistributionItem, rawPct: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return;
    const metricValue = metric === 'count' ? item.count : item.sales;
    setTooltip({
      name: item.short,
      metricValue,
      metricPct: rawPct,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, [metric]);

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  // Keyboard focus shows the same tooltip, positioned at the segment's center
  // (no mouse coords), so the distribution is reachable without a pointer.
  const handleFocus = useCallback((e: React.FocusEvent<HTMLDivElement>, item: SegmentDistributionItem, rawPct: number) => {
    const barRect = barRef.current?.getBoundingClientRect();
    const segRect = e.currentTarget.getBoundingClientRect();
    if (!barRect) return;
    setTooltip({
      name: item.short,
      metricValue: metric === 'count' ? item.count : item.sales,
      metricPct: rawPct,
      x: segRect.left - barRect.left + segRect.width / 2,
      y: segRect.top - barRect.top,
    });
  }, [metric]);

  if (total === 0) {
    return (
      <div className="mb-5">
        <div className="text-xs text-zinc-500 mb-1.5 font-medium">{label}</div>
        <div className="h-10 bg-zinc-100 rounded-xl flex items-center justify-center text-xs text-zinc-400">
          Sin datos
        </div>
      </div>
    );
  }

  return (
    <div className="mb-5 relative">
      <div className="text-xs text-zinc-500 mb-1.5 font-medium">{label}</div>
      <div ref={barRef} role="group" aria-label={`Distribución: ${label}`} className="flex h-10 rounded-xl overflow-hidden">
        {sorted.map((item) => {
          const value = metric === 'count' ? item.count : item.sales;
          const rawPct = (value / total) * 100;
          const pct = Math.max(rawPct, 0.5);
          const bgColor = SEGMENT_COLORS[item.short] ?? '#d1d5db';
          const textColor = getTextColor(bgColor);

          return (
            <div
              key={item.short}
              role="button"
              tabIndex={0}
              aria-label={`${item.short}: ${rawPct.toFixed(1)}%`}
              className="relative flex items-center justify-center text-xs font-medium cursor-default hover:brightness-110 hover:saturate-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
              style={{
                width: animated ? `${pct}%` : '0%',
                backgroundColor: bgColor,
                color: textColor,
                minWidth: animated ? '4px' : '0px',
                transition: `width 700ms cubic-bezier(0.4, 0, 0.2, 1), min-width 700ms cubic-bezier(0.4, 0, 0.2, 1)`,
                overflow: 'hidden',
              }}
              onMouseMove={(e) => handleMouseMove(e, item, rawPct)}
              onMouseLeave={handleMouseLeave}
              onFocus={(e) => handleFocus(e, item, rawPct)}
              onBlur={handleMouseLeave}
            >
              {rawPct >= 3 && (
                <span className="truncate px-1 text-[11px]">
                  {item.short} {rawPct.toFixed(1)}%
                </span>
              )}
            </div>
          );
        })}
      </div>

      {showMarginBadge && (
        <div className="flex mt-1">
          {sorted.map((item) => {
            const rawPct = (item.sales / total) * 100;
            const pct = Math.max(rawPct, 0.5);
            const marginPct = item.sales !== 0 ? (item.gross_margin / item.sales) * 100 : 0;

            return (
              <div
                key={item.short}
                className="flex items-center justify-center"
                style={{ width: `${pct}%` }}
              >
                {rawPct > 8 && (
                  <span className="text-[10px] text-zinc-500">
                    MB: {marginPct.toFixed(1)}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div
        className="absolute z-20 bg-white/95 backdrop-blur-sm border border-zinc-200 rounded-xl shadow-lg px-3 py-2.5 text-xs pointer-events-none transition-all duration-150 ease-out"
        style={{
          left: tooltip ? Math.min(Math.max(tooltip.x - 60, 0), 280) : 0,
          top: tooltip ? tooltip.y - 80 : 0,
          opacity: tooltip ? 1 : 0,
          transform: tooltip ? 'translateY(0)' : 'translateY(4px)',
        }}
      >
        {tooltip && (
          <>
            <div className="font-semibold text-zinc-800 mb-1">{tooltip.name}</div>
            <div className="text-zinc-600">
              {metric === 'count' ? `${label}: ${tooltip.metricValue.toLocaleString()}` : `Ventas: $ ${formatCurrency(tooltip.metricValue)}`}
            </div>
            <div className="text-zinc-600">
              % {metric === 'count' ? label.toLowerCase() : 'ventas'} sobre total: {tooltip.metricPct.toFixed(1)}%
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface SegmentDistributionChartProps {
  filters?: FilterMap;
  /** Restrict the entity selector to these keys (default: all). */
  entityOptions?: string[];
  /** Initially selected entity type. */
  defaultEntity?: string;
}

export function SegmentDistributionChart({ filters, entityOptions, defaultEntity }: SegmentDistributionChartProps = {}) {
  const visibleEntityOptions = entityOptions
    ? ENTITY_OPTIONS.filter((o) => entityOptions.includes(o.key))
    : ENTITY_OPTIONS;

  const [analysisType, setAnalysisType] = useState<AnalysisType>('value');
  const [entityType, setEntityType] = useState(defaultEntity ?? visibleEntityOptions[0]?.key ?? 'customer_id');
  const { startDate, endDate } = useDateRange();
  const { data, isLoading } = useQube6Distribution(entityType, startDate, endDate, filters);

  const items = data?.data?.[analysisType] ?? [];
  const totalCount = items.reduce((acc, i) => acc + i.count, 0);
  const totalSales = items.reduce((acc, i) => acc + i.sales, 0);

  const sorted = sortSegments(items, analysisType);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <h3 className="text-sm font-semibold text-zinc-700">Análisis IA Qube6</h3>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <AppSelect
            size="sm"
            aria-label="Tipo de análisis"
            selectedKeys={[analysisType]}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0] as AnalysisType;
              if (selected) setAnalysisType(selected);
            }}
            className="w-full sm:w-52"
            listboxProps={{
              itemClasses: {
                base: 'cursor-pointer',
              },
            }}
          >
            {ANALYSIS_OPTIONS.map((opt) => (
              <SelectItem key={opt.key} className="!cursor-pointer" style={{ cursor: 'pointer' }}>{opt.label}</SelectItem>
            ))}
          </AppSelect>
          {visibleEntityOptions.length > 1 && (
            <Tabs
              size="sm"
              selectedKey={entityType}
              onSelectionChange={(key) => setEntityType(key as string)}
            >
              {visibleEntityOptions.map((opt) => (
                <Tab key={opt.key} title={opt.label} />
              ))}
            </Tabs>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-5">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center text-sm text-zinc-400 py-8">
          Sin datos para el periodo seleccionado
        </div>
      ) : (
        <>
          <StackedBar
            label={ENTITY_OPTIONS.find((o) => o.key === entityType)?.label ?? 'Entidades'}
            items={items}
            total={totalCount}

            metric="count"
            analysisType={analysisType}
          />
          <StackedBar
            label="Ventas"
            items={items}
            total={totalSales}

            metric="sales"
            analysisType={analysisType}
            showMarginBadge
          />

          <div className="flex flex-wrap gap-4 mt-3">
            {sorted.map((item) => (
              <div key={item.short} className="flex items-center gap-1.5 text-xs text-zinc-600">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: SEGMENT_COLORS[item.short] ?? '#d1d5db' }}
                />
                {item.short}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
