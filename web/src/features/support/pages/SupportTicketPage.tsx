import { useParams, useNavigate } from 'react-router-dom';
import { Breadcrumbs, BreadcrumbItem, Button, Link, Skeleton } from '@heroui/react';
import { PageHeader } from '@/core/components/PageHeader';
import { useAuthStore } from '@/core/store/authStore';
import { APIError } from '@/core/api/client';
import { TICKET_TYPE } from '../config/support';
import { useSupportTicket } from '../hooks/useSupport';
import { useOpenTicketContext } from '../hooks/useOpenTicketContext';
import { formatDateTime } from '../utils/relativeTime';
import { parseTicketNumber } from '../utils/ticketNumber';
import { TicketStatusChip } from '../components/TicketChips';
import { TicketThread } from '../components/TicketThread';
import { AgentPanel } from '../components/AgentPanel';
import { ScreenshotPreview } from '../components/ScreenshotPreview';

function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-start gap-3 py-8">
      <p className="text-sm text-default-600">No encontramos esta solicitud.</p>
      <Link className="cursor-pointer text-sm" onPress={() => navigate('/soporte')}>
        Volver a Soporte
      </Link>
    </div>
  );
}

/** /soporte/:number — one request: thread, screenshot and, for agents, the triage panel. */
export function SupportTicketPage() {
  const number = parseTicketNumber(useParams().number);
  const navigate = useNavigate();
  const isAgent = useAuthStore((s) => s.realDynaRole === 'ADMIN');
  const openContext = useOpenTicketContext();
  const { data: ticket, isLoading, error } = useSupportTicket(number);

  const breadcrumbs = (
    <Breadcrumbs size="sm" onAction={(key) => key === 'soporte' && navigate('/soporte')}>
      <BreadcrumbItem key="soporte">Soporte</BreadcrumbItem>
      <BreadcrumbItem key="ticket">{number ? `#${number}` : 'Solicitud'}</BreadcrumbItem>
    </Breadcrumbs>
  );

  if (number === null || (error instanceof APIError && error.status === 404)) {
    return (
      <div>
        <PageHeader title="Soporte" showDateFilter={false} breadcrumbs={breadcrumbs} subtitle="" />
        <NotFound />
      </div>
    );
  }
  if (isLoading || !ticket) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Cargando solicitud">
        {error ? (
          <p className="text-sm text-danger">No pudimos cargar la solicitud.</p>
        ) : (
          <>
            <Skeleton className="h-10 w-2/3 rounded-lg" />
            <Skeleton className="h-32 rounded-xl" />
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`#${ticket.number} · ${ticket.subject}`}
        showDateFilter={false}
        breadcrumbs={breadcrumbs}
        titleAccessory={<TicketStatusChip status={ticket.status} />}
        subtitle={`${TICKET_TYPE[ticket.type].label} · Enviada el ${formatDateTime(ticket.createdAt)}`}
      />

      <div className={`grid gap-6 ${isAgent ? 'lg:grid-cols-[minmax(0,1fr)_320px]' : ''}`}>
        <div className="flex min-w-0 flex-col gap-6">
          {!isAgent && ticket.context.path && (
            <div>
              <Button size="sm" variant="bordered" className="cursor-pointer" onPress={() => openContext(ticket.context)}>
                Abrir la pantalla
              </Button>
            </div>
          )}
          <TicketThread ticket={ticket} isAgent={isAgent} />
          {ticket.hasScreenshot && (
            <section aria-label="Captura de pantalla" className="max-w-xl">
              <h2 className="mb-2 text-sm font-semibold text-default-700">Captura de pantalla</h2>
              <ScreenshotPreview number={ticket.number} />
            </section>
          )}
        </div>
        {isAgent && <AgentPanel ticket={ticket} />}
      </div>
    </div>
  );
}
