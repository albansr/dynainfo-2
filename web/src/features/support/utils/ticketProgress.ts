import { AUTO_CLOSE_DAYS, RESPONSE_EXPECTATION, type TicketStatus } from '../config/support';
import { formatRelative } from './relativeTime';

export const PROGRESS_STEPS = ['Enviada', 'En revisión', 'Resuelta', 'Cerrada'] as const;

interface ProgressInput {
  status: TicketStatus;
  awaitingTeam: boolean;
  satisfied: boolean | null;
  resolvedAt: string | null;
  lastActivityAt: string;
}

export interface TicketProgress {
  /** Index in PROGRESS_STEPS. */
  step: number;
  /** What happens next, for whoever is looking. */
  message: string;
  /** Agents: true when the team has to answer (highlighted). */
  teamTurn: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const LONG_DATE = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long' });

/** "22 de octubre" */
export function formatLongDate(date: Date): string {
  return LONG_DATE.format(date);
}

/** Where a request stands and what to expect: for the requester or for an agent. */
export function ticketProgress(ticket: ProgressInput, viewer: 'requester' | 'agent', now: Date = new Date()): TicketProgress {
  const teamTurn = ticket.awaitingTeam && (ticket.status === 'open' || ticket.status === 'in_progress');

  if (ticket.status === 'resolved') {
    const resolvedAt = new Date(ticket.resolvedAt ?? ticket.lastActivityAt);
    const closesOn = new Date(resolvedAt.getTime() + AUTO_CLOSE_DAYS * DAY_MS);
    return {
      step: 2,
      message: `Resuelta el ${formatLongDate(resolvedAt)}. Si ${viewer === 'agent' ? 'el usuario no dice' : 'no nos dices'} nada, se cerrará el ${formatLongDate(closesOn)}.`,
      teamTurn: false,
    };
  }
  if (ticket.status === 'closed') {
    const confirmed = ticket.satisfied === true;
    return {
      step: 3,
      message: confirmed
        ? viewer === 'agent'
          ? 'Cerrada. El usuario confirmó que se solucionó.'
          : 'Cerrada. Gracias por confirmarnos que se solucionó.'
        : 'Cerrada.',
      teamTurn: false,
    };
  }

  const step = ticket.status === 'in_progress' || !ticket.awaitingTeam ? 1 : 0;
  if (viewer === 'agent') {
    const since = formatRelative(ticket.lastActivityAt, now);
    return {
      step,
      message: teamTurn
        ? `Le toca al equipo${since === 'ahora' ? '' : ` desde ${since}`}.`
        : 'Esperando la respuesta del usuario.',
      teamTurn,
    };
  }
  if (!ticket.awaitingTeam) return { step, message: 'Te hemos respondido. Contesta abajo cuando puedas.', teamTurn };
  if (ticket.status === 'in_progress') return { step, message: 'Estamos trabajando en ello.', teamTurn };
  return { step, message: `La hemos recibido. ${RESPONSE_EXPECTATION}`, teamTurn };
}
