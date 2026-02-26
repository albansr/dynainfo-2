import { formatNumber, formatPercent } from '../utils/formatters';
import {
  getVariationColor,
  getComplianceColor
} from '../utils/heatmap';
import type { CellRenderer } from '../config/types';

// Sales cell renderer (variation with arrow)
export const salesCellRenderer: CellRenderer = (_data, config, value) => {
  const { current, previous, variation } = value;
  const thresholds = config.thresholds!;
  const varColor = getVariationColor(variation, thresholds);
  const arrow = variation > 0 ? '↑' : variation < 0 ? '↓' : '';

  return (
    <div className="px-4 text-right py-2.5">
      <div className="text-[13px] text-zinc-900">
        <span className="text-[11px] text-zinc-500">{config.currency}</span>{' '}
        <span className="font-semibold">{formatNumber(current, config.locale)}</span>{' '}
        <span className="text-[11px] font-semibold" style={{ color: varColor.text }}>
          {arrow} {formatPercent(Math.abs(variation), config.locale, 2)}%
        </span>
      </div>
      <div className="text-[11px] text-zinc-400 mt-1">
        {config.previousYear}: {config.currency} {formatNumber(previous, config.locale)}
      </div>
    </div>
  );
};

// Compliance cell renderer (amount + compliance %)
export const complianceCellRenderer: CellRenderer = (_data, config, value) => {
  const { amount, compliance } = value;

  // If no budget, show dash without color
  if (amount === 0) {
    return (
      <div className="px-4 text-right py-2.5">
        <div className="text-[13px] text-zinc-400">-</div>
      </div>
    );
  }

  const thresholds = config.thresholds!;
  const compColor = getComplianceColor(compliance, thresholds);

  return (
    <div className="px-4 text-right py-2.5">
      <div className="text-[13px] text-zinc-900">
        <span className="text-[11px] text-zinc-500">{config.currency}</span>{' '}
        <span className="font-semibold">{formatNumber(amount, config.locale)}</span>
      </div>
      <div className="text-[11px] font-semibold mt-1" style={{ color: compColor.text }}>
        {formatPercent(compliance, config.locale, 2)}% cumpl.
      </div>
    </div>
  );
};

// Margin cell renderer (current margin + variation %)
export const marginCellRenderer: CellRenderer = (_data, config, value) => {
  const { current, previous, variation } = value;

  // Color based on variation, matching background color logic
  let marginColor: string;
  if (variation > 2) marginColor = '#15803d'; // Strong green if up >2%
  else if (variation > 0) marginColor = '#16a34a'; // Soft green if up
  else if (variation >= -2) marginColor = '#64748b'; // Neutral if small variation
  else marginColor = '#dc2626'; // Red if down >2%

  const deltaColor = variation > 0 ? '#15803d' : variation < 0 ? '#dc2626' : '#64748b';
  const arrow = variation > 0 ? '↑' : variation < 0 ? '↓' : '';

  return (
    <div className="px-4 text-right py-2.5">
      <div className="text-[13px]">
        <span className="font-semibold" style={{ color: marginColor }}>
          {formatPercent(current, config.locale, 2)}%
        </span>{' '}
        <span className="text-[10px] font-semibold" style={{ color: deltaColor }}>
          {arrow}{formatPercent(Math.abs(variation), config.locale, 2)}%
        </span>
      </div>
      <div className="text-[11px] text-zinc-400 mt-1">
        {config.previousYear}: {formatPercent(previous, config.locale, 2)}%
      </div>
    </div>
  );
};

// Margin budget cell renderer
export const marginBudgetCellRenderer: CellRenderer = (_data, config, value) => {
  const { budget, real } = value;

  // If no budget, show dash without color
  if (budget === 0) {
    return (
      <div className="px-4 text-right py-2.5">
        <div className="text-[13px] text-zinc-400">-</div>
      </div>
    );
  }

  const delta = budget - real;
  // Color based on delta - red when budget > real (bad), green when real > budget (good)
  let budgetTextColor: string;
  if (delta >= 2) budgetTextColor = '#dc2626'; // Red strong (budget much higher than real - bad)
  else if (delta >= 0.5) budgetTextColor = '#dc2626'; // Red soft
  else if (delta >= -0.5) budgetTextColor = '#64748b'; // Neutral
  else if (delta >= -2) budgetTextColor = '#16a34a'; // Green soft (real higher than budget - good)
  else budgetTextColor = '#15803d'; // Green strong

  const arrow = delta > 0 ? '↓' : delta < 0 ? '↑' : '';
  const relation = delta > 0 ? 'b/ppto' : delta < 0 ? 's/ppto' : 'ppto';

  return (
    <div className="px-4 text-right py-2.5">
      <div className="text-[13px] font-semibold" style={{ color: budgetTextColor }}>
        {formatPercent(budget, config.locale, 2)}%
      </div>
      <div className="text-[11px] font-semibold mt-1" style={{ color: budgetTextColor }}>
        Real {arrow}{formatPercent(Math.abs(delta), config.locale, 2)}pp {relation}
      </div>
    </div>
  );
};

// Simple text cell
export const textCellRenderer: CellRenderer = (_data, _config, value) => {
  return (
    <div className="px-4 text-left py-2.5">
      <div className="text-[12px] font-medium text-zinc-900">
        {value}
      </div>
    </div>
  );
};
