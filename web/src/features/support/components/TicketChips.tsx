import { Chip } from '@heroui/react';
import { TICKET_PRIORITY, TICKET_STATUS, type TicketPriority, type TicketStatus } from '../config/support';

export function TicketStatusChip({ status }: { status: TicketStatus }) {
  const { label, color } = TICKET_STATUS[status];
  return (
    <Chip size="sm" variant="flat" color={color}>
      {label}
    </Chip>
  );
}

export function TicketPriorityChip({ priority }: { priority: TicketPriority }) {
  const { label, color } = TICKET_PRIORITY[priority];
  return (
    <Chip size="sm" variant={priority === 'high' ? 'flat' : 'bordered'} color={color}>
      {label}
    </Chip>
  );
}

/** Colored dot next to a label (status and priority selectors). The label carries the meaning. */
export function Dot({ className }: { className: string }) {
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${className}`} aria-hidden="true" />;
}

/** A status or priority option: dot + label (selector items and the selected value). */
export function DotLabel({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <Dot className={dot} />
      {label}
    </span>
  );
}
