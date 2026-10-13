import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReachMetricsBlock } from './ReachMetricsBlock';

describe('ReachMetricsBlock', () => {
  it('shows Items, Numérica and Clientes sin compra with the detail trigger', () => {
    render(
      <ReachMetricsBlock
        reach={{ productos_unicos: 5540, clientes_unicos: 1562, clientes_sin_compra: 6657 }}
        isLoading={false}
        sinCompraTooltip="Definición"
        sinCompraDescription="Clientes activos sin compra"
        sinCompraDetail={<button type="button">Ver quiénes son</button>}
      />
    );

    expect(screen.getByText('ITEMS')).toBeInTheDocument();
    expect(screen.getByText('5.540')).toBeInTheDocument();
    expect(screen.getByText('NUMÉRICA')).toBeInTheDocument();
    expect(screen.getByText('1.562')).toBeInTheDocument();
    expect(screen.getByText('CLIENTES SIN COMPRA')).toBeInTheDocument();
    expect(screen.getByText('6.657')).toBeInTheDocument();
    expect(screen.getByText('Clientes activos sin compra')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver quiénes son' })).toBeInTheDocument();
  });

  it('falls back to zeros while there is no data', () => {
    render(
      <ReachMetricsBlock
        reach={undefined}
        isLoading={false}
        sinCompraTooltip=""
        sinCompraDescription=""
        sinCompraDetail={null}
      />
    );

    expect(screen.getAllByText('0')).toHaveLength(3);
  });

  it('hides Clientes sin compra on boards the customer master does not cover', () => {
    render(
      <ReachMetricsBlock
        reach={{ productos_unicos: 12, clientes_unicos: 7, clientes_sin_compra: null }}
        isLoading={false}
        sinCompraTooltip=""
        sinCompraDescription=""
        sinCompraDetail={null}
      />
    );

    expect(screen.getByText('ITEMS')).toBeInTheDocument();
    expect(screen.getByText('NUMÉRICA')).toBeInTheDocument();
    expect(screen.queryByText('CLIENTES SIN COMPRA')).not.toBeInTheDocument();
  });
});
