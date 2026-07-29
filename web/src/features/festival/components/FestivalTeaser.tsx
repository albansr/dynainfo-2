import { useState } from 'react';
import { format, differenceInCalendarDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button, Input } from '@heroui/react';
import { NavBadge } from '@/core/components/NavBadge';
import {
  FESTIVALS,
  FESTIVAL_ACCESS_CODE,
  FESTIVAL_ACCESS_STORAGE_KEY,
} from '../config/festival';

interface FestivalTeaserProps {
  /** Called when the visitor enters the valid access code. */
  onUnlock: () => void;
}

/**
 * Validation-phase announcement shown instead of the dashboard: FV2 is
 * coming, with a live countdown, plus a discreet access-code form for the
 * reviewers. Rendered only while FESTIVAL_ACCESS_CODE is set.
 */
export function FestivalTeaser({ onUnlock }: FestivalTeaserProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);

  const fv2 = FESTIVALS.find((f) => f.id === 'fv2') ?? FESTIVALS[0]!;
  const today = new Date();
  const daysLeft = differenceInCalendarDays(fv2.startDate, today);
  const isLive = daysLeft <= 0 && differenceInCalendarDays(fv2.endDate, today) >= 0;

  const submit = () => {
    if (code.trim() === FESTIVAL_ACCESS_CODE) {
      localStorage.setItem(FESTIVAL_ACCESS_STORAGE_KEY, code.trim());
      onUnlock();
    } else {
      setError(true);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center text-center px-4 py-16 sm:py-24">
      <NavBadge type="live" size="md" label="Festival Virtual" />

      <h1 className="mt-6 text-3xl sm:text-4xl font-bold text-zinc-900">
        ¡El {fv2.name} ya está aquí!
      </h1>

      <p className="mt-3 text-lg text-zinc-600">
        Del {format(fv2.startDate, 'd', { locale: es })} al{' '}
        {format(fv2.endDate, "d 'de' MMMM 'de' yyyy", { locale: es })}
      </p>

      <p className="mt-4 text-2xl font-semibold text-primary">
        {isLive ? '¡En marcha!' : daysLeft > 0 ? `Quedan ${daysLeft} días` : 'Finalizado'}
      </p>

      <p className="mt-6 max-w-xl text-sm text-zinc-500">
        Muy pronto tendrás en este espacio un dashboard para analizar el festival
        en vivo: ventas, margen, pedidos, clientes y mucho más.
      </p>

      {/* Acceso para validadores */}
      <div className="mt-12 w-full max-w-xs">
        <p className="text-xs text-zinc-400 mb-3">¿Tienes un código de acceso?</p>
        <div className="flex gap-2">
          <Input
            aria-label="Código de acceso"
            type="password"
            size="sm"
            placeholder="Código de acceso"
            value={code}
            isInvalid={error}
            errorMessage={error ? 'Código incorrecto' : undefined}
            onValueChange={(v) => {
              setCode(v);
              setError(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
          />
          <Button size="sm" color="primary" onPress={submit}>
            Acceder
          </Button>
        </div>
      </div>
    </div>
  );
}
