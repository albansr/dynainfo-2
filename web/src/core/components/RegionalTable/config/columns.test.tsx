import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RegionalTable } from '../RegionalTable';
import type { RegionalData, TableConfig } from '../types';
import { getColumnsWithDynamicLabel, getColumnsWithoutBudget, toProductListingColumns } from './columns';

const ids = (cols: { id: string }[]): string[] => cols.map((c) => c.id);

describe('toProductListingColumns', () => {
  it('leads with item code + reference, drops CARTERA and ends with UNIDADES + PRECIO PROMEDIO + COSTO PROMEDIO', () => {
    const cols = toProductListingColumns(getColumnsWithDynamicLabel('product_id'));

    expect(ids(cols)).toEqual([
      'itemCode', 'reference', 'regional', 'sales', 'budget', 'margin', 'marginBudget', 'units', 'avgUnitPrice', 'avgUnitCost',
    ]);
    expect(cols.slice(-3).map((c) => c.header.label)).toEqual(['UNIDADES', 'PRECIO PROM.', 'COSTO PROM.']);
  });

  it('applies the same layout to the budget-less listing', () => {
    const cols = toProductListingColumns(getColumnsWithoutBudget('product_id'));

    expect(ids(cols)).not.toContain('retained');
    expect(ids(cols).slice(-3)).toEqual(['units', 'avgUnitPrice', 'avgUnitCost']);
  });
});

describe('product unit cells', () => {
  const config: TableConfig = { currency: '$', locale: 'es-CO', currentYear: 2026, previousYear: 2025 };
  const base: RegionalData = {
    id: 'P1',
    name: 'Producto 1',
    sales: { current: 100, previous: 80, variation: 25 },
    budget: { amount: 0, compliance: 0 },
    margin: { current: 40, previous: 38, variation: 2, budget: 0 },
    retained: { amount: 0, compliance: 0 },
  };
  const columns = toProductListingColumns(getColumnsWithoutBudget('product_id'));

  it('renders units and the average unit cost', () => {
    render(
      <RegionalTable data={[{ ...base, units: { current: 1500, avgCost: 4200 } }]} columns={columns} config={config} />
    );

    expect(screen.getByText('1.500')).toBeInTheDocument();
    expect(screen.getByText('4.200')).toBeInTheDocument();
  });

  it('shows the evolution vs last year with the sales colors', () => {
    render(
      <RegionalTable
        data={[{ ...base, units: { current: 1500, previous: 1000, avgCost: 4200, avgCostPrevious: 4000 } }]}
        columns={columns}
        config={config}
      />
    );

    const unitsGrowth = screen.getByText('↑ 50,00%');
    const costGrowth = screen.getByText('↑ 5,00%');
    expect(screen.getByText('2025: 1.000')).toBeInTheDocument();
    expect(screen.getByText('2025: $ 4.000')).toBeInTheDocument();
    // Same scale as VENTAS: a rise reads like a sales rise in both columns
    const salesGrowth = screen.getByText('↑ 25,00%');
    expect(unitsGrowth.style.color).toBe(salesGrowth.style.color);
    expect(costGrowth.style.color).not.toBe('');
  });

  it('shows N/A when there is no last-year base', () => {
    render(
      <RegionalTable
        data={[{ ...base, units: { current: 1500, previous: 0, avgCost: 4200, avgCostPrevious: 0 } }]}
        columns={columns}
        config={config}
      />
    );

    expect(screen.getAllByText('N/A').length).toBeGreaterThanOrEqual(2);
  });

  it('shows a dash for the average cost when there are no units', () => {
    render(<RegionalTable data={[{ ...base, units: { current: 0, avgCost: 0 } }]} columns={columns} config={config} />);

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getAllByText('-').length).toBeGreaterThan(0);
  });
});
