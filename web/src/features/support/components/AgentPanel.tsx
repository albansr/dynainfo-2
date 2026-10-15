import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Link,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  SelectItem,
  Tooltip,
} from '@heroui/react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { AppSelect } from '@/core/components/AppSelect';
import { getRoleLabel } from '@/core/config/access';
import { useAuthStore } from '@/core/store/authStore';
import { useChangelogEntries } from '@/features/changelog/hooks/useChangelog';
import {
  TICKET_PRIORITIES,
  TICKET_PRIORITY,
  TICKET_STATUSES,
  TICKET_STATUS,
  type TicketPriority,
  type TicketStatus,
} from '../config/support';
import { useUpdateTicket, type TicketDetail, type TicketPatch } from '../hooks/useSupport';
import { useOpenTicketContext } from '../hooks/useOpenTicketContext';
import { formatRelative } from '../utils/relativeTime';
import { ContextFacts } from './ContextFacts';
import { ScreenshotPreview } from './ScreenshotPreview';
import { DotLabel, TicketStatusChip } from './TicketChips';

function roleText(dynaRole: string | null | undefined, scope?: string | null): string {
  const role = getRoleLabel(dynaRole) || 'Sin rol';
  return scope ? `${role} · ${scope}` : role;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-default-700">{title}</h2>
      {children}
    </section>
  );
}

/** Agents' side panel: triage, reproduce (context, screenshot, "Ver como su rol"), the requester and related requests. */
export function AgentPanel({ ticket }: { ticket: TicketDetail }) {
  const update = useUpdateTicket(ticket.number);
  const openContext = useOpenTicketContext();
  const navigate = useNavigate();
  const agentRole = useAuthStore((s) => s.realDynaRole);
  const [resolving, setResolving] = useState(false);
  const { context } = ticket;
  const sameRole = (context.dynaRole ?? null) === agentRole;
  // The UI role differs from the real one: the requester was using the demo role
  const roleMismatch = context.realDynaRole !== undefined && (context.realDynaRole ?? null) !== (context.dynaRole ?? null);

  const save = (patch: TicketPatch, success: string) =>
    update.mutate(patch, {
      onSuccess: () => toast.success(success),
      onError: () => toast.error('No pudimos guardar el cambio. Inténtalo de nuevo.'),
    });

  const onStatus = (status: TicketStatus) => {
    if (status === ticket.status) return;
    if (status === 'resolved') setResolving(true);
    else save({ status }, 'Estado actualizado');
  };

  return (
    <aside className="flex flex-col gap-6 rounded-xl border border-default-200 p-4" aria-label="Gestión de la solicitud">
      <div className="grid grid-cols-2 gap-3">
        <AppSelect
          label="Estado"
          size="sm"
          selectedKeys={[ticket.status]}
          disallowEmptySelection
          renderValue={() => <DotLabel {...TICKET_STATUS[ticket.status]} />}
          onSelectionChange={(keys) => {
            const key = Array.from(keys)[0];
            if (key) onStatus(key as TicketStatus);
          }}
        >
          {TICKET_STATUSES.map((s) => (
            <SelectItem key={s} textValue={TICKET_STATUS[s].label} className="cursor-pointer">
              <DotLabel {...TICKET_STATUS[s]} />
            </SelectItem>
          ))}
        </AppSelect>
        <AppSelect
          label="Prioridad"
          size="sm"
          selectedKeys={[ticket.priority]}
          disallowEmptySelection
          renderValue={() => <DotLabel {...TICKET_PRIORITY[ticket.priority]} />}
          onSelectionChange={(keys) => {
            const key = Array.from(keys)[0] as TicketPriority | undefined;
            if (key && key !== ticket.priority) save({ priority: key }, 'Prioridad actualizada');
          }}
        >
          {TICKET_PRIORITIES.map((p) => (
            <SelectItem key={p} textValue={TICKET_PRIORITY[p].label} className="cursor-pointer">
              <DotLabel {...TICKET_PRIORITY[p]} />
            </SelectItem>
          ))}
        </AppSelect>
      </div>

      <Section title="Reproducir">
        {ticket.hasScreenshot && <ScreenshotPreview number={ticket.number} />}
        <div className="flex flex-col gap-2">
          <Button color="primary" variant="flat" className="cursor-pointer" onPress={() => openContext(context)}>
            Abrir donde estaba
          </Button>
          <Tooltip content="El usuario tiene tu mismo rol" isDisabled={!sameRole}>
            <span>
              <Button
                variant="bordered"
                className="w-full cursor-pointer"
                isDisabled={sameRole}
                onPress={() => openContext(context, { ticketNumber: ticket.number })}
              >
                Ver como su rol ({roleText(context.dynaRole, context.scope)})
              </Button>
            </span>
          </Tooltip>
        </div>
        <ContextFacts context={context} />
        {roleMismatch && (
          <p className="flex items-start gap-2 rounded-lg bg-warning-50 p-2 text-xs text-warning-800">
            <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Estaba simulando un rol: su rol real es {roleText(context.realDynaRole)}.
          </p>
        )}
        {(context.viewport || context.userAgent) && (
          <p className="text-xs text-default-400">
            {context.viewport && `${context.viewport.width} × ${context.viewport.height} · `}
            {context.userAgent}
          </p>
        )}
      </Section>

      <Section title="Solicitante">
        <p className="text-sm">
          {ticket.requester.name && <span className="font-medium">{ticket.requester.name} · </span>}
          <span className="text-default-600">{ticket.requester.email}</span>
        </p>
      </Section>

      {ticket.related && ticket.related.length > 0 && (
        <Section title="Relacionadas">
          <ul className="flex flex-col divide-y divide-default-100">
            {ticket.related.map((r) => (
              <li key={r.number} className="flex flex-col gap-1 py-2 first:pt-0">
                <Link className="cursor-pointer text-sm" onPress={() => navigate(`/soporte/${r.number}`)}>
                  #{r.number} · {r.subject}
                </Link>
                <span className="flex flex-wrap items-center gap-2 text-xs text-default-500">
                  <TicketStatusChip status={r.status} />
                  {r.sameRequester ? 'Mismo usuario' : 'Misma pantalla y filtros'} · {formatRelative(r.lastActivityAt)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <ResolveModal
        ticket={ticket}
        isOpen={resolving}
        onClose={() => setResolving(false)}
        onConfirm={(changelogEntryId) =>
          update.mutate(
            { status: 'resolved', changelogEntryId },
            {
              onSuccess: () => {
                setResolving(false);
                toast.success('Solicitud resuelta y usuario avisado');
              },
              onError: () => toast.error('No pudimos guardar el cambio. Inténtalo de nuevo.'),
            },
          )
        }
        isSaving={update.isPending}
      />
    </aside>
  );
}

interface ResolveModalProps {
  ticket: TicketDetail;
  isOpen: boolean;
  isSaving: boolean;
  onClose: () => void;
  onConfirm: (changelogEntryId: string | null) => void;
}

/** "Marcar como resuelta": optional Novedades entry that solved it; the requester is emailed. */
function ResolveModal({ ticket, isOpen, isSaving, onClose, onConfirm }: ResolveModalProps) {
  const { data: entries = [] } = useChangelogEntries();
  const [entryId, setEntryId] = useState<string | null>(ticket.changelogEntryId);
  const name = ticket.requester.name ?? ticket.requester.email;

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ModalContent>
        <ModalHeader>Marcar como resuelta</ModalHeader>
        <ModalBody className="gap-4">
          <AppSelect
            label="Novedad relacionada"
            placeholder="Ninguna"
            size="sm"
            selectedKeys={entryId ? [entryId] : []}
            onSelectionChange={(keys) => setEntryId((Array.from(keys)[0] as string | undefined) ?? null)}
          >
            {entries.map((entry) => (
              <SelectItem key={entry.id} className="cursor-pointer">
                {entry.title}
              </SelectItem>
            ))}
          </AppSelect>
          <p className="text-sm text-default-600">
            Enviaremos un correo a {name} con tu última respuesta y le preguntaremos si se solucionó.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" className="cursor-pointer" onPress={onClose}>
            Cancelar
          </Button>
          <Button color="primary" className="cursor-pointer" isLoading={isSaving} onPress={() => onConfirm(entryId)}>
            Marcar como resuelta
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
