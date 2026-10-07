import { useMemo, type ReactNode } from 'react';
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
import { useAuthStore } from '@/core/store/authStore';
import { isEstadoTeamRole } from '@/core/config/access';
import { useSellerStatus, useSellersStatus, type SellerStatus } from '../hooks/useSellerStatus';
import { SellersStatusTable } from '../components/SellersStatusTable';

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
  /** Optional business figure line (billing, margin, decline…). */
  stat?: string;
}

const DOT: Record<Tone, string> = {
  rose: 'bg-rose-500',
  amber: 'bg-amber-500',
};

const num = (v: number) => v.toLocaleString('es-CO');
const money = (v: number) =>
  Math.abs(v) >= 1e6
    ? `$${(v / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M`
    : `$${v.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
const pct = (v: number) => `${v.toLocaleString('es-CO', { maximumFractionDigits: 0 })}%`;

function buildCards(s: SellerStatus): InsightCard[] {
  return [
    {
      key: 'sin_compra',
      tone: 'rose',
      icon: ClockIcon,
      value: s.sinCompra,
      headline: 'clientes se enfriaron',
      detail: 'Te compraron antes pero no en los últimos 3 meses. Un contacto a tiempo los reactiva.',
    },
    {
      key: 'riesgo',
      tone: 'rose',
      icon: ExclamationTriangleIcon,
      value: s.riesgo,
      headline: 'clientes en riesgo y cayendo',
      detail: 'Clasificados en riesgo comercial y con evolución negativa. Priorízalos antes de perderlos.',
      stat: `${money(s.riesgoSales)} de facturación anual · ${pct(s.riesgoMarginPct)} margen en juego`,
    },
    {
      key: 'promesa',
      tone: 'amber',
      icon: SparklesIcon,
      value: s.promesa,
      headline: 'promesas creciendo',
      detail: 'Clasificados como promesa y creciendo vs. el año anterior. Un empujón los consolida.',
      stat: `${money(s.promesaSales)} de facturación anual · ${pct(s.promesaMarginPct)} margen`,
    },
    {
      key: 'peso',
      tone: 'rose',
      icon: ArrowTrendingDownIcon,
      value: s.pesoRetrocediendo,
      of: s.pesoTotal,
      headline: 'de tus clientes clave están cayendo',
      detail: `Tus ${num(s.pesoTotal)} clientes clave concentran el 80% de tus ventas de los últimos 12 meses. Estos ${num(s.pesoRetrocediendo)} retroceden frente al año anterior.`,
      stat: `Pesan el ${pct(s.pesoDeclineSharePct)} de tus ventas · caen ${money(s.pesoDecline)} vs. el año anterior`,
    },
  ];
}

/** A focus card: a button for sellers (opens their clients), static for team roles. */
function CardShell({ onClick, children }: { onClick?: () => void; children: ReactNode }) {
  if (!onClick) return <div className="flex flex-col bg-white p-5 text-left">{children}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex cursor-pointer flex-col bg-white p-5 text-left transition-colors hover:bg-zinc-50"
    >
      {children}
    </button>
  );
}

export function EstadoPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useSellerStatus();
  // Directors / admin / management: totals for their scope (not clickable) + a row per seller
  const isTeam = isEstadoTeamRole(useAuthStore((s) => s.user?.dynaRole));
  const { data: sellers, isLoading: sellersLoading } = useSellersStatus(isTeam);

  const cards = useMemo(() => (data ? buildCards(data) : []), [data]);
  const coverage = data && data.activos > 0 ? Math.round((data.numerica / data.activos) * 100) : 0;

  return (
    <div>
      <PageHeader
        title="Estado"
        showDateFilter={false}
        subtitle={isTeam ? 'La cartera de tus vendedores, dónde poner el foco' : 'Tu cartera de clientes, dónde poner el foco'}
      />

      {/* Current-month coverage (always this month) */}
      <section className="mb-6 border-b border-zinc-200 pb-6">
        {isLoading || !data ? (
          <Skeleton className="h-9 w-80 rounded-md" />
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">Numérica</span>
              <span className="text-3xl font-semibold tracking-tight text-zinc-900">{num(data.numerica)}</span>
              <span className="text-sm text-zinc-500">
                de {num(data.activos)} clientes activos te compraron este mes · <span className="font-semibold text-zinc-700">un {coverage}%</span> del total
              </span>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
              <div className="h-full rounded-full bg-zinc-900" style={{ width: `${coverage}%` }} />
            </div>
            {!isTeam && <button
              type="button"
              onClick={() => navigate('/estado/sin_compra_mes')}
              className="mt-3 inline-flex cursor-pointer items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-900"
            >
              Ver los {num(data.activos - data.numerica)} que no te compraron este mes
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </button>}
          </>
        )}
      </section>

      <p className="mb-3 mt-2 text-xs font-medium uppercase tracking-wide text-zinc-400">Dónde poner el foco</p>
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
                <CardShell
                  key={card.key}
                  {...(isTeam ? {} : { onClick: () => navigate(`/estado/${card.key}`) })}
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
                  {card.stat && <p className="mt-2 text-xs font-medium text-zinc-500">{card.stat}</p>}
                  {!isTeam && (
                    <span className="mt-4 inline-flex items-center gap-1 text-sm text-zinc-400 transition-colors group-hover:text-zinc-900">
                      Ver clientes
                      <ArrowRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  )}
                </CardShell>
              );
            })}
      </div>

      {isTeam && <SellersStatusTable rows={sellers} isLoading={sellersLoading} />}
    </div>
  );
}
