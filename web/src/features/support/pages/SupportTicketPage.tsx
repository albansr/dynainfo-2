import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Breadcrumbs, BreadcrumbItem, Link, Skeleton } from '@heroui/react';
import { PageHeader } from '@/core/components/PageHeader';
import { useAuthStore, selectIsSupportAgent } from '@/core/store/authStore';
import { APIError } from '@/core/api/client';
import { TICKET_TYPE } from '../config/support';
import { useSupportTicket } from '../hooks/useSupport';
import { formatDateTime } from '../utils/relativeTime';
import { parseTicketNumber } from '../utils/ticketNumber';
import { TicketPriorityChip, TicketStatusChip } from '../components/TicketChips';
import { TicketThread } from '../components/TicketThread';
import { AgentPanel } from '../components/AgentPanel';
import { StatusTimeline } from '../components/StatusTimeline';
import { FeedbackCard } from '../components/FeedbackCard';
import { SubmittedContextCard } from '../components/SubmittedContextCard';

/** ?feedback=solved|not_solved from the resolved email's buttons. */
function feedbackParam(value: string | null): 'solved' | 'not_solved' | null {
  return value === 'solved' || value === 'not_solved' ? value : null;
}

function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-start gap-3 py-8">
      <p className="text-sm text-default-600">No encontramos esta solicitud.</p>
      <Link className="cursor-pointer text-sm" onPress={() => navigate('/soporte')}>
        Volver a las solicitudes
      </Link>
    </div>
  );
}

/** /soporte/:number — the request as a conversation, where it stands, and the side card (what was sent, or the agents' panel). */
export function SupportTicketPage() {
  const number = parseTicketNumber(useParams().number);
  const navigate = useNavigate();
  const { hash } = useLocation();
  const [searchParams] = useSearchParams();
  const isAgent = useAuthStore(selectIsSupportAgent);
  const { data: ticket, isLoading, error } = useSupportTicket(number);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const suggestedFeedback = feedbackParam(searchParams.get('feedback'));

  // Email links land on the reply box (#responder)
  useEffect(() => {
    if (hash === '#responder' && ticket) {
      document.getElementById('responder')?.scrollIntoView({ block: 'center' });
      composerRef.current?.focus();
    }
  }, [hash, ticket]);

  const listUrl = isAgent ? '/soporte' : '/soporte?ver=mias';
  const breadcrumbs = (
    <Breadcrumbs size="sm" onAction={(key) => key === 'soporte' && navigate(listUrl)}>
      <BreadcrumbItem key="soporte">{isAgent ? 'Solicitudes' : 'Mis solicitudes'}</BreadcrumbItem>
      <BreadcrumbItem key="ticket">{number ? `#${number}` : 'Solicitud'}</BreadcrumbItem>
    </Breadcrumbs>
  );

  if (number === null || (error instanceof APIError && error.status === 404)) {
    return (
      <div>
        <PageHeader title="Solicitud no encontrada" showDateFilter={false} breadcrumbs={breadcrumbs} subtitle="" />
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
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </>
        )}
      </div>
    );
  }

  const isRequester = !isAgent;
  return (
    <div>
      <PageHeader
        title={`#${ticket.number} · ${ticket.subject}`}
        showDateFilter={false}
        breadcrumbs={breadcrumbs}
        titleAccessory={
          <span className="flex items-center gap-2">
            <TicketStatusChip status={ticket.status} />
            {isAgent && <TicketPriorityChip priority={ticket.priority} />}
          </span>
        }
        subtitle={`${TICKET_TYPE[ticket.type].label} · Enviada el ${formatDateTime(ticket.createdAt)}`}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 max-w-3xl flex-col gap-5">
          <StatusTimeline ticket={ticket} viewer={isAgent ? 'agent' : 'requester'} />
          {isRequester && ticket.status === 'resolved' && <FeedbackCard number={ticket.number} suggested={suggestedFeedback} />}
          <TicketThread ref={composerRef} ticket={ticket} isAgent={isAgent} />
        </div>
        {isAgent ? <AgentPanel ticket={ticket} /> : <SubmittedContextCard ticket={ticket} />}
      </div>
    </div>
  );
}
