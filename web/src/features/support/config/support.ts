import type { ChipProps } from '@heroui/react';

export const TICKET_TYPES = ['error', 'data', 'access', 'suggestion'] as const;
export const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
export const TICKET_PRIORITIES = ['high', 'medium', 'low'] as const;

export type TicketType = (typeof TICKET_TYPES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

/** Request type: label and a one-line hint for the new-request form. */
export const TICKET_TYPE: Record<TicketType, { label: string; hint: string }> = {
  error: { label: 'Error en la app', hint: 'Algo no funciona, no carga o se rompe.' },
  data: { label: 'Dato incorrecto', hint: 'Una cifra no cuadra: ventas, presupuesto, cartera…' },
  access: { label: 'Acceso o permisos', hint: 'No ves una vista, regional o vendedor que deberías ver.' },
  suggestion: { label: 'Sugerencia', hint: 'Una idea o algo que te gustaría tener.' },
};

/** Status (feminine: "la solicitud") with its chip color. */
export const TICKET_STATUS: Record<TicketStatus, { label: string; color: ChipProps['color'] }> = {
  open: { label: 'Abierta', color: 'primary' },
  in_progress: { label: 'En curso', color: 'warning' },
  resolved: { label: 'Resuelta', color: 'success' },
  closed: { label: 'Cerrada', color: 'default' },
};

/** Priority (agents only) with its chip color. */
export const TICKET_PRIORITY: Record<TicketPriority, { label: string; color: ChipProps['color'] }> = {
  high: { label: 'Alta', color: 'danger' },
  medium: { label: 'Media', color: 'default' },
  low: { label: 'Baja', color: 'default' },
};

/** Status filter of the agents' list: "active" = open + in progress (the default). */
export type StatusFilter = TicketStatus | 'active' | 'all';
export const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  active: 'Abiertas y en curso',
  all: 'Todas',
  ...Object.fromEntries(TICKET_STATUSES.map((s) => [s, TICKET_STATUS[s].label])),
} as Record<StatusFilter, string>;

/** The screenshot is suggested where it helps reproduce: errors and wrong data. */
export function screenshotByDefault(type: TicketType | null): boolean {
  return type === 'error' || type === 'data';
}

/** Form limits (mirror the API validation). */
export const SUBJECT_MIN = 3;
export const SUBJECT_MAX = 120;
export const DESCRIPTION_MIN = 10;
export const DESCRIPTION_MAX = 5000;
