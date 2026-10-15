import { useNavigate } from 'react-router-dom';
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Pagination } from '@heroui/react';
import { TICKET_TYPE } from '../config/support';
import { TICKETS_PAGE_SIZE, type TicketSummary } from '../hooks/useSupport';
import { formatRelative } from '../utils/relativeTime';
import { TicketPriorityChip, TicketStatusChip } from './TicketChips';

interface TicketListProps {
  tickets: TicketSummary[];
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  /** Agents' "Todas" view: adds Solicitante and Prioridad. */
  showAgentColumns: boolean;
  isLoading: boolean;
  emptyContent: string;
}

/** Support requests table; a row opens the request (keyboard included, via react-aria). */
export function TicketList({ tickets, total, page, onPageChange, showAgentColumns, isLoading, emptyContent }: TicketListProps) {
  const navigate = useNavigate();
  const pages = Math.max(1, Math.ceil(total / TICKETS_PAGE_SIZE));
  const columns = [
    { key: 'number', label: 'N.º' },
    { key: 'subject', label: 'Asunto' },
    ...(showAgentColumns ? [{ key: 'requester', label: 'Solicitante' }] : []),
    { key: 'type', label: 'Tipo' },
    { key: 'status', label: 'Estado' },
    ...(showAgentColumns ? [{ key: 'priority', label: 'Prioridad' }] : []),
    { key: 'activity', label: 'Última actividad' },
  ];

  const cell = (ticket: TicketSummary, key: string) => {
    switch (key) {
      case 'number':
        return <span className="font-medium text-default-600">#{ticket.number}</span>;
      case 'subject':
        return <span className="font-medium text-foreground">{ticket.subject}</span>;
      case 'requester':
        return ticket.requester?.name ?? ticket.requester?.email ?? '';
      case 'type':
        return TICKET_TYPE[ticket.type].label;
      case 'status':
        return <TicketStatusChip status={ticket.status} />;
      case 'priority':
        return <TicketPriorityChip priority={ticket.priority} />;
      default:
        return <span className="text-default-500">{formatRelative(ticket.lastActivityAt)}</span>;
    }
  };

  return (
    <Table
      aria-label="Solicitudes de soporte"
      selectionMode="none"
      removeWrapper
      classNames={{ base: 'overflow-x-auto', table: 'min-w-[560px]', tr: 'cursor-pointer' }}
      onRowAction={(key) => navigate(`/soporte/${String(key)}`)}
      bottomContent={
        pages > 1 ? (
          <div className="flex justify-center">
            <Pagination page={page} total={pages} onChange={onPageChange} showControls size="sm" />
          </div>
        ) : null
      }
    >
      <TableHeader columns={columns}>{(column) => <TableColumn key={column.key}>{column.label}</TableColumn>}</TableHeader>
      <TableBody items={tickets} isLoading={isLoading} loadingContent="Cargando solicitudes…" emptyContent={emptyContent}>
        {(ticket) => (
          <TableRow key={ticket.number} aria-label={`Abrir solicitud #${ticket.number}`}>
            {(key) => <TableCell>{cell(ticket, String(key))}</TableCell>}
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
