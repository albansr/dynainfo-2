import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegionalTable } from './RegionalTable';
import type { RegionalData, TableConfig } from './types';

const row: RegionalData = {
  id: 'R1',
  name: 'Costa Atlántica',
  sales: { current: 100, previous: 80, variation: 25 },
  budget: { amount: 120, compliance: 83 },
  margin: { current: 40, previous: 38, variation: 2, budget: 39 },
  retained: { amount: 5, compliance: 4 },
};

const config: TableConfig = { currency: '$', locale: 'es-CO', currentYear: 2025, previousYear: 2024 };

describe('RegionalTable accessibility', () => {
  it('renders a clickable row as a keyboard-activatable control with a label', async () => {
    const onRowClick = vi.fn();
    render(<RegionalTable data={[row]} config={config} onRowClick={onRowClick} />);

    const rowEl = screen.getByRole('button', { name: /Ver detalle de Costa Atlántica/i });
    expect(rowEl).toHaveAttribute('tabindex', '0');

    rowEl.focus();
    await userEvent.keyboard('{Enter}');
    expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'R1' }));
  });

  it('does not make rows interactive when there is no onRowClick', () => {
    render(<RegionalTable data={[row]} config={config} />);
    expect(screen.queryByRole('button', { name: /Ver detalle/i })).toBeNull();
  });

  it('marks column headers with scope="col"', () => {
    render(<RegionalTable data={[row]} config={config} />);
    const colHeaders = screen.getAllByRole('columnheader');
    expect(colHeaders.length).toBeGreaterThan(0);
    // At least one data column header exposes a scope for screen readers.
    expect(colHeaders.some((th) => th.getAttribute('scope') === 'col')).toBe(true);
  });
});
