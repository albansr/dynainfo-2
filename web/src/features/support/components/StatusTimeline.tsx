import { CheckIcon } from '@heroicons/react/24/solid';
import type { TicketDetail } from '../hooks/useSupport';
import { PROGRESS_STEPS, ticketProgress } from '../utils/ticketProgress';

/** Where the request stands (Enviada → En revisión → Resuelta → Cerrada) and what happens next. */
export function StatusTimeline({ ticket, viewer }: { ticket: TicketDetail; viewer: 'requester' | 'agent' }) {
  const { step, message, teamTurn } = ticketProgress(ticket, viewer);

  return (
    <section aria-label="Estado de la solicitud" className="rounded-xl border border-default-200 p-4">
      <ol className="flex items-center gap-2">
        {PROGRESS_STEPS.map((label, i) => {
          const done = i < step || (i === step && step === PROGRESS_STEPS.length - 1);
          const current = i === step;
          return (
            <li key={label} className="flex flex-1 items-center gap-2 last:flex-none" aria-current={current ? 'step' : undefined}>
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  done ? 'bg-primary text-white' : current ? 'border-2 border-primary text-primary' : 'border border-default-300 text-default-400'
                }`}
              >
                {done ? <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" /> : i + 1}
              </span>
              <span className={`text-xs sm:text-sm ${current ? 'font-semibold text-foreground' : 'text-default-500'}`}>{label}</span>
              {i < PROGRESS_STEPS.length - 1 && <span className="hidden h-px flex-1 bg-default-200 sm:block" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
      <p className={`mt-3 text-sm ${teamTurn ? 'font-medium text-warning-700' : 'text-default-600'}`}>{message}</p>
    </section>
  );
}
