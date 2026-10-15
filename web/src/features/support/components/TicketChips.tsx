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
