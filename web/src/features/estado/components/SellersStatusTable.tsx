import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@heroui/react';
import type { SellerStatusRow } from '../hooks/useSellerStatus';

interface Column {
  /** Estado detail preset opened by the cell. */
  preset: string;
  label: string;
  value: (row: SellerStatusRow) => number;
  of?: (row: SellerStatusRow) => number;
}

const COLUMNS: Column[] = [
  { preset: 'sin_compra_mes', label: 'Sin compra este mes', value: (r) => r.activos - r.numerica, of: (r) => r.activos },
  { preset: 'sin_compra', label: 'Se enfriaron', value: (r) => r.sinCompra },
  { preset: 'riesgo', label: 'En riesgo y cayendo', value: (r) => r.riesgo },
  { preset: 'promesa', label: 'Promesas creciendo', value: (r) => r.promesa },
  { preset: 'peso', label: 'Clientes clave cayendo', value: (r) => r.pesoRetrocediendo, of: (r) => r.pesoTotal },
];

const num = (v: number) => v.toLocaleString('es-CO');

/**
 * Team Estado (directors, admin, management): one row per seller with the
 * client count of each segment. A cell opens that seller's clients in that
 * segment — the same detail the seller sees.
 */
export function SellersStatusTable({ rows, isLoading }: { rows: SellerStatusRow[] | undefined; isLoading: boolean }) {
  const navigate = useNavigate();

  return (
    <section className="mt-8">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-400">Por vendedor</p>
      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : !rows?.length ? (
        <p className="text-sm text-zinc-500">No hay vendedores con ventas en los últimos 12 meses.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200">
          <table className="w-full text-left">
            <thead className="bg-zinc-50">
              <tr className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                <th scope="col" className="px-4 py-3">Vendedor</th>
                {COLUMNS.map((c) => (
                  <th key={c.preset} scope="col" className="px-4 py-3 text-right">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.seller_id} className="border-t border-zinc-100 text-sm">
                  <td className="px-4 py-2.5 font-medium text-zinc-900">{row.seller_name}</td>
                  {COLUMNS.map((c) => {
                    const value = c.value(row);
                    const params = new URLSearchParams({ seller: row.seller_id, sellerName: row.seller_name });
                    return (
                      <td key={c.preset} className="px-2 py-1 text-right">
                        <button
                          type="button"
                          onClick={() => navigate(`/estado/${c.preset}?${params.toString()}`)}
                          aria-label={`${c.label}: ${num(value)} clientes de ${row.seller_name}`}
                          className="w-full cursor-pointer rounded-md px-2 py-1.5 text-right text-zinc-800 transition-colors hover:bg-zinc-100"
                        >
                          <span className="font-semibold">{num(value)}</span>
                          {c.of && <span className="text-zinc-400"> / {num(c.of(row))}</span>}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
