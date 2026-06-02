import { useRef, useEffect, useCallback } from 'react';
import * as echarts from 'echarts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { BalanceSeriesItem } from '@/core/api/types';
import { formatCurrency } from '@/core/utils/formatters';

interface SalesBarChartProps {
  series: BalanceSeriesItem[];
  granularity: 'day' | 'month';
  title: string;
  isLoading?: boolean;
}

export function SalesBarChart({ series, granularity, title, isLoading }: SalesBarChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  const formatPeriod = useCallback(
    (period: string): string => {
      const date = new Date(`${period}T12:00:00`);
      return granularity === 'day'
        ? format(date, 'd MMM', { locale: es })
        : format(date, 'MMM yyyy', { locale: es });
    },
    [granularity]
  );

  useEffect(() => {
    if (!chartRef.current) return;

    const instance = echarts.init(chartRef.current, undefined, { renderer: 'canvas' });
    instanceRef.current = instance;

    const handleResize = () => instance.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      instance.dispose();
      instanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance) return;

    if (isLoading || series.length === 0) {
      instance.showLoading({ text: '', color: '#6366f1', maskColor: 'rgba(255,255,255,0.6)' });
      return;
    }

    instance.hideLoading();

    const n = series.length;
    const salesData = series.map((d) => d.sales);
    const avgSales = salesData.reduce((a, b) => a + b, 0) / n;
    // Budget per period comes already prorated from the backend
    const avgBudget = series.reduce((a, d) => a + d.budget, 0) / n;

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        formatter: (params: echarts.DefaultLabelFormatterCallbackParams | echarts.DefaultLabelFormatterCallbackParams[]) => {
          const items = Array.isArray(params) ? params : [params];
          let html = `<strong>${(items[0] as any)?.axisValueLabel ?? ''}</strong><br/>`;
          for (const item of items as any[]) {
            html += `${item.marker ?? ''} ${item.seriesName}: <strong>$ ${formatCurrency(item.value as number)}</strong><br/>`;
          }
          return html;
        },
      },
      legend: {
        bottom: 0,
        icon: 'circle',
        textStyle: { fontSize: 11 },
      },
      grid: {
        left: '1%',
        right: '2%',
        bottom: '12%',
        top: '6%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: series.map((d) => formatPeriod(d.period)),
        axisLabel: { fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        name: 'VENTAS',
        nameLocation: 'middle',
        nameGap: 55,
        nameTextStyle: { fontSize: 11, color: '#6b7280' },
        axisLabel: {
          fontSize: 10,
          formatter: (val: number) => {
            if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(0)}B`;
            if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(0)}M`;
            if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
            return String(val);
          },
        },
      },
      series: [
        {
          name: 'VENTAS',
          type: 'bar',
          data: salesData,
          itemStyle: { color: '#4b5563', borderRadius: [2, 2, 0, 0] },
        },
        {
          name: 'PROMEDIO PPTO',
          type: 'line',
          data: series.map(() => avgBudget),
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { type: 'dashed', color: '#3b82f6', width: 1.5 },
          itemStyle: { color: '#3b82f6' },
        },
        {
          name: 'PROMEDIO DE VENTAS',
          type: 'line',
          data: series.map(() => avgSales),
          symbol: 'diamond',
          symbolSize: 7,
          lineStyle: { type: 'dashed', color: '#ef4444', width: 1.5 },
          itemStyle: { color: '#ef4444' },
        },
      ],
    };

    instance.setOption(option, true);
  }, [series, granularity, isLoading, formatPeriod]);

  return (
    <div>
      <h3 className="text-xs font-semibold text-center uppercase tracking-widest text-gray-700 mb-2">
        {title}
      </h3>
      <div ref={chartRef} className="h-72 w-full" />
    </div>
  );
}
