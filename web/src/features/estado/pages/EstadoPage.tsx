import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Skeleton } from '@heroui/react';
import {
  ClockIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  ArrowTrendingDownIcon,
  UsersIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { PageHeader } from '@/core/components/PageHeader';
import { useSellerStatus, type SellerStatus } from '../hooks/useSellerStatus';

type Severity = 'danger' | 'warning' | 'positive';

interface InsightCard {
  key: string;
  severity: Severity;
  icon: typeof ClockIcon;
  value: number;
  of?: number;
  /** Headline continues the number: "<value> <headline>". */
  headline: string;
  detail: string;
}

const SEVERITY: Record<Severity, { ring: string; tint: string; accent: string; text: string; iconBg: string }> = {
  danger: {
    ring: 'hover:border-rose-300',
    tint: 'bg-rose-50/60',
    accent: 'bg-rose-500',
    text: 'text-rose-600',
    iconBg: 'bg-rose-100 text-rose-600',
  },
  warning: {
    ring: 'hover:border-amber-300',
    tint: 'bg-amber-50/60',
    accent: 'bg-amber-500',
    text: 'text-amber-600',
    iconBg: 'bg-amber-100 text-amber-600',
  },
  positive: {
    ring: 'hover:border-emerald-300',
    tint: 'bg-emerald-50/60',
    accent: 'bg-emerald-500',
    text: 'text-emerald-600',
    iconBg: 'bg-emerald-100 text-emerald-600',
  },
};

const num = (v: number) => v.toLocaleString('es-CO');

function buildCards(s: SellerStatus): InsightCard[] {
  return [
    {
      key: 'sin_compra',
      severity: 'danger',
      icon: ClockIcon,
      value: s.sinCompra,
      headline: 'clientes se enfriaron',
      detail: 'Te compraron antes pero no este mes. Un contacto a tiempo los reactiva.',
    },
    {
      key: 'riesgo',
      severity: 'danger',
      icon: ExclamationTriangleIcon,
      value: s.riesgo,
      headline: 'clientes en riesgo',
      detail: 'Clasificados en riesgo comercial. Priorízalos antes de perderlos.',
    },
    {
      key: 'promesa',
      severity: 'warning',
      icon: SparklesIcon,
      value: s.promesa,
      headline: 'promesas por consolidar',
      detail: 'Van por buen camino; un empujón los convierte en clientes fuertes.',
    },
    {
      key: 'peso',
      severity: 'danger',
      icon: ArrowTrendingDownIcon,
      value: s.pesoRetrocediendo,
      of: s.pesoTotal,
      headline: 'de tus clientes clave están cayendo',
      detail: 'Concentran el 80% de tus ventas y retroceden frente al año pasado.',
    },
  ];
}

export function EstadoPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useSellerStatus();

  const cards = useMemo(() => (data ? buildCards(data) : []), [data]);

  return (
    <div>
      <PageHeader title="Estado" />

      {/* Positive anchor: how many clients bought this month */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
          <UsersIcon className="h-6 w-6" />
        </div>
        <div>
          {isLoading || !data ? (
            <Skeleton className="h-7 w-56 rounded-md" />
          ) : (
            <p className="text-lg text-zinc-700">
              <span className="text-2xl font-bold text-emerald-600">{num(data.numerica)}</span>{' '}
              clientes te compraron este mes
            </p>
          )}
          <p className="text-sm text-zinc-500">Tu base activa. Debajo, dónde poner el foco.</p>
        </div>
      </motion.div>

      {/* Insight cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {isLoading || !data
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-2xl" />
            ))
          : cards.map((card, i) => {
              const s = SEVERITY[card.severity];
              const Icon = card.icon;
              return (
                <motion.button
                  key={card.key}
                  type="button"
                  onClick={() => navigate(`/estado/${card.key}`)}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`group relative flex w-full cursor-pointer items-start gap-4 overflow-hidden rounded-2xl border border-zinc-200 ${s.tint} p-5 text-left transition-colors ${s.ring}`}
                >
                  <span className={`absolute inset-y-0 left-0 w-1.5 ${s.accent}`} aria-hidden />
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${s.iconBg}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-zinc-900">
                      <span className={`text-3xl font-bold ${s.text}`}>{num(card.value)}</span>
                      {card.of !== undefined && (
                        <span className="text-base font-medium text-zinc-400"> / {num(card.of)}</span>
                      )}{' '}
                      <span className="text-base font-semibold">{card.headline}</span>
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">{card.detail}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-zinc-600 group-hover:text-zinc-900">
                      Ver clientes
                      <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </motion.button>
              );
            })}
      </div>
    </div>
  );
}
