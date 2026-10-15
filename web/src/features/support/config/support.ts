import type { ComponentType, SVGProps } from 'react';
import type { ChipProps } from '@heroui/react';
import { BugAntIcon, ChartBarIcon, KeyIcon, LightBulbIcon } from '@heroicons/react/24/outline';

export const TICKET_TYPES = ['error', 'data', 'access', 'suggestion'] as const;
export const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
export const TICKET_PRIORITIES = ['high', 'medium', 'low'] as const;

export type TicketType = (typeof TICKET_TYPES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

interface TicketTypeInfo {
  label: string;
  hint: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** The question that guides the description for this type. */
  prompt: string;
  placeholder: string;
}

/** Request type: label, hint, icon and the guided question of the new-request form. */
export const TICKET_TYPE: Record<TicketType, TicketTypeInfo> = {
  error: {
    label: 'Error en la app',
    hint: 'Algo no funciona o no carga',
    icon: BugAntIcon,
    prompt: '¿Qué hiciste justo antes y qué pasó?',
    placeholder: 'Ej.: pulsé Exportar a Excel y no descargó nada',
  },
  data: {
    label: 'Dato incorrecto',
    hint: 'Una cifra no cuadra',
    icon: ChartBarIcon,
    prompt: '¿Qué cifra ves y cuál esperabas?',
    placeholder: 'Ej.: el presupuesto de VERA sale en 0 y debería ser unos 34.000 millones',
  },
  access: {
    label: 'Acceso o permisos',
    hint: 'No ves algo que deberías',
    icon: KeyIcon,
    prompt: '¿Qué vista, regional o vendedor necesitas ver?',
    placeholder: 'Ej.: necesito ver la regional Centro además de la mía',
  },
  suggestion: {
    label: 'Sugerencia',
    hint: 'Una idea o mejora',
    icon: LightBulbIcon,
    prompt: '¿Qué te gustaría poder hacer?',
    placeholder: 'Ej.: poder comparar dos vendedores en la misma tabla',
  },
};

/** Status (feminine: "la solicitud") with its chip color and the dot used in selectors. */
export const TICKET_STATUS: Record<TicketStatus, { label: string; color: ChipProps['color']; dot: string }> = {
  open: { label: 'Abierta', color: 'primary', dot: 'bg-primary' },
  in_progress: { label: 'En curso', color: 'warning', dot: 'bg-warning' },
  resolved: { label: 'Resuelta', color: 'success', dot: 'bg-success' },
  closed: { label: 'Cerrada', color: 'default', dot: 'bg-default-400' },
};

/** Priority (agents only) with its chip color and the dot used in selectors. */
export const TICKET_PRIORITY: Record<TicketPriority, { label: string; color: ChipProps['color']; dot: string }> = {
  high: { label: 'Alta', color: 'danger', dot: 'bg-danger' },
  medium: { label: 'Media', color: 'default', dot: 'bg-default-400' },
  low: { label: 'Baja', color: 'default', dot: 'bg-default-200' },
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

/** Days a resolved request waits for the requester before closing (mirrors the API). */
export const AUTO_CLOSE_DAYS = 7;

/** What the requester can expect, shown under the status. */
export const RESPONSE_EXPECTATION = 'Normalmente respondemos en 1 día hábil.';

/** Agents' quick replies (they can edit the text before sending). */
export const QUICK_REPLIES: { key: string; label: string; text: string }[] = [
  { key: 'reviewing', label: 'Lo estamos revisando', text: 'Gracias por avisarnos. Lo estamos revisando y te contamos en cuanto lo tengamos.' },
  { key: 'more-info', label: 'Pedir más detalle', text: '¿Nos puedes decir qué fechas y filtros tenías y qué cifra esperabas ver?' },
  { key: 'fixed', label: 'Ya está corregido', text: 'Ya está corregido. ¿Puedes volver a probar y confirmarnos que lo ves bien?' },
  { key: 'access', label: 'Acceso dado', text: 'Te hemos dado acceso. Cierra sesión y vuelve a entrar para verlo.' },
];

/** Subject for a request: the one written, or the description's first line (shortened). */
export function ticketSubject(subject: string, description: string): string {
  const written = subject.trim();
  if (written.length >= SUBJECT_MIN) return written.slice(0, SUBJECT_MAX);
  const firstLine = description.trim().split('\n')[0]?.trim() ?? '';
  return firstLine.length > 80 ? `${firstLine.slice(0, 79).trimEnd()}…` : firstLine;
}
