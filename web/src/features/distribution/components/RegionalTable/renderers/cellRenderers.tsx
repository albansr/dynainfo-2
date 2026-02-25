import { formatNumber, formatPercent } from '../utils/formatters';
import {
  getVariationColor,
  getComplianceColor,
  getMarginColor
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
      <div className="text-[10px] text-zinc-400 mt-1">
        {config.previousYear}: {config.currency} {formatNumber(previous, config.locale)}
      </div>
    </div>
  );
};

// Compliance cell renderer (amount + compliance %)
export const complianceCellRenderer: CellRenderer = (_data, config, value) => {
  const { amount, compliance } = value;
  const thresholds = config.thresholds!;
  const compColor = getComplianceColor(compliance, thresholds);

  return (
    <div className="px-4 text-right py-2.5">
      <div className="text-[13px] text-zinc-900">
        <span className="text-[11px] text-zinc-500">{config.currency}</span>{' '}
        <span className="font-semibold">{formatNumber(amount, config.locale)}</span>
      </div>
      <div className="text-[10px] font-semibold mt-1" style={{ color: compColor.text }}>
        {formatPercent(compliance, config.locale, 2)}% cumpl.
      </div>
    </div>
  );
};

// Margin cell renderer (current margin + variation %)
export const marginCellRenderer: CellRenderer = (_data, config, value) => {
  const { current, previous, variation } = value;
  const thresholds = config.thresholds!;
  const marginColor = getMarginColor(current, thresholds);
  const deltaColor = variation > 0 ? '#15803d' : variation < 0 ? '#dc2626' : '#64748b';
  const arrow = variation > 0 ? '↑' : variation < 0 ? '↓' : '';

  return (
    <div className="px-4 text-right py-2.5">
      <div className="text-[13px]">
        <span className="font-semibold" style={{ color: marginColor.text }}>
          {formatPercent(current, config.locale, 2)}%
        </span>{' '}
        <span className="text-[10px] font-semibold" style={{ color: deltaColor }}>
          {arrow}{formatPercent(Math.abs(variation), config.locale, 2)}%
        </span>
      </div>
      <div className="text-[10px] text-zinc-400 mt-1">
        {config.previousYear}: {formatPercent(previous, config.locale, 2)}%
      </div>
    </div>
  );
};

// Margin budget cell renderer
export const marginBudgetCellRenderer: CellRenderer = (_data, config, value) => {
  const { budget, real } = value;
  const delta = real - budget;
  // Color based on delta to match background color logic
  let budgetTextColor: string;
  if (delta >= 2) budgetTextColor = '#15803d'; // Green strong
  else if (delta >= 0.5) budgetTextColor = '#16a34a'; // Green soft
  else if (delta >= -0.5) budgetTextColor = '#64748b'; // Neutral
  else budgetTextColor = '#dc2626'; // Red

  const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '';

  return (
    <div className="px-4 text-right py-2.5">
      <div className="text-[13px] font-semibold" style={{ color: budgetTextColor }}>
        {formatPercent(budget, config.locale, 2)}%
      </div>
      <div className="text-[10px] font-semibold mt-1" style={{ color: budgetTextColor }}>
        {arrow}{formatPercent(Math.abs(delta), config.locale, 2)}pp real
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
