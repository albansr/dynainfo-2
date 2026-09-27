import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@heroui/react';
import {
  ClockIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  ArrowTrendingDownIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { PageHeader } from '@/core/components/PageHeader';
import { useDateRange } from '@/core/hooks/useDateRange';
import { useSellerStatus, type SellerStatus } from '../hooks/useSellerStatus';

type Tone = 'rose' | 'amber';

interface InsightCard {
  key: string;
  tone: Tone;
  icon: typeof ClockIcon;
  value: number;
  of?: number;
  /** Headline continues the number: "<value> <headline>". */
  headline: string;
  detail: string;
  /** Optional business figure line (sales, margin, decline…). */
  stat?: string;
}

const DOT: Record<Tone, string> = {
  rose: 'bg-rose-500',
  amber: 'bg-amber-500',
};

const PERIOD_PHRASE: Record<string, string> = {
  'current-month': 'este mes',
  'previous-month': 'el mes pasado',
  accumulated: 'en lo que va del año',
  today: 'hoy',
};

const num = (v: number) => v.toLocaleString('es-CO');
const money = (v: number) =>
  Math.abs(v) >= 1e6
    ? `$${(v / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M`
    : `$${v.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
const pct = (v: number) => `${v.toLocaleString('es-CO', { maximumFractionDigits: 0 })}%`;

function buildCards(s: SellerStatus, period: string): InsightCard[] {
  return [
    {
      key: 'sin_compra',
      tone: 'rose',
      icon: ClockIcon,
      value: s.sinCompra,
      headline: 'clientes se enfriaron',
      detail: `Te compraron antes pero no ${period}. Un contacto a tiempo los reactiva.`,
    },
    {
      key: 'riesgo',
      tone: 'rose',
      icon: ExclamationTriangleIcon,
      value: s.riesgo,
      headline: 'clientes en riesgo',
      detail: 'Clasificados en riesgo comercial. Priorízalos antes de perderlos.',
      stat: `${money(s.riesgoSales)} en ventas · ${pct(s.riesgoMarginPct)} margen en juego`,
    },
    {
      key: 'promesa',
      tone: 'amber',
      icon: SparklesIcon,
      value: s.promesa,
      headline: 'promesas por consolidar',
      detail: 'Van por buen camino; un empujón los convierte en clientes fuertes.',
      stat: `${money(s.promesaSales)} en ventas · ${pct(s.promesaMarginPct)} margen`,
    },
    {
      key: 'peso',
      tone: 'rose',
      icon: ArrowTrendingDownIcon,
      value: s.pesoRetrocediendo,
      of: s.pesoTotal,
      headline: 'de tus clientes clave están cayendo',
      detail: `Tus ${num(s.pesoTotal)} clientes clave concentran el 80% de tus ventas. Estos ${num(s.pesoRetrocediendo)} retroceden frente al año pasado.`,
      stat: `Pesan el ${pct(s.pesoDeclineSharePct)} de tus ventas · caen ${money(s.pesoDecline)} vs. el año pasado`,
    },
  ];
}

export function EstadoPage() {
  const navigate = useNavigate();
  const { preset } = useDateRange();
  const { data, isLoading } = useSellerStatus();

  const period = PERIOD_PHRASE[preset] ?? 'en el periodo';
  const cards = useMemo(() => (data ? buildCards(data, period) : []), [data, period]);
  const activeBase = data ? data.numerica + data.sinCompra : 0;
  const coverage = activeBase > 0 ? Math.round((data!.numerica / activeBase) * 100) : 0;

  return (
    <div>
      <PageHeader title="Estado" />

      {/* Coverage summary */}
      <section className="border-b border-zinc-200 pb-6">
        {isLoading || !data ? (
          <Skeleton className="h-9 w-80 rounded-md" />
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold tracking-tight text-zinc-900">{num(data.numerica)}</span>
              <span className="text-sm text-zinc-500">de {num(activeBase)} clientes activos te compraron {period}</span>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
              <div className="h-full rounded-full bg-zinc-900" style={{ width: `${coverage}%` }} />
            </div>
            <p className="mt-2 text-xs text-zinc-400">{coverage}% de tu base activa compró en el periodo</p>
          </>
        )}
      </section>

      {/* Focus areas */}
      <p className="mb-3 mt-6 text-xs font-medium uppercase tracking-wide text-zinc-400">Dónde poner el foco</p>
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 sm:grid-cols-2">
        {isLoading || !data
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white p-5">
                <Skeleton className="h-24 w-full rounded-md" />
              </div>
            ))
          : cards.map((card) => {
              const Icon = card.icon;
              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => navigate(`/estado/${card.key}`)}
                  className="group flex cursor-pointer flex-col bg-white p-5 text-left transition-colors hover:bg-zinc-50"
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${DOT[card.tone]}`} aria-hidden />
                    <Icon className="h-4 w-4 text-zinc-400" />
                  </div>
                  <p className="mt-3 text-zinc-800">
                    <span className="text-3xl font-semibold tracking-tight text-zinc-900">{num(card.value)}</span>
                    {card.of !== undefined && (
                      <span className="text-lg font-medium text-zinc-300"> / {num(card.of)}</span>
                    )}{' '}
                    <span className="text-sm text-zinc-600">{card.headline}</span>
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{card.detail}</p>
                  {card.stat && (
                    <p className="mt-2 text-xs font-medium text-zinc-500">{card.stat}</p>
                  )}
                  <span className="mt-4 inline-flex items-center gap-1 text-sm text-zinc-400 transition-colors group-hover:text-zinc-900">
                    Ver clientes
                    <ArrowRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </button>
              );
            })}
      </div>
    </div>
  );
}
