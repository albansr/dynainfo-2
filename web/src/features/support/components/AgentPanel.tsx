import { useState } from 'react';
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  SelectItem,
  Tooltip,
} from '@heroui/react';
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
import { contextFilters, dateRangeText } from '../utils/supportContext';

function roleText(dynaRole: string | null | undefined, scope: string | null | undefined): string {
  const role = getRoleLabel(dynaRole) || 'Sin rol';
  return scope ? `${role} · ${scope}` : role;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-default-500">{label}</dt>
      <dd className="break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

/** Agents' side panel: triage (status, priority), the captured context and the reproduce actions. */
export function AgentPanel({ ticket }: { ticket: TicketDetail }) {
  const update = useUpdateTicket(ticket.number);
  const openContext = useOpenTicketContext();
  const agentRole = useAuthStore((s) => s.realDynaRole);
  const [resolving, setResolving] = useState(false);
  const { context } = ticket;
  const filters = contextFilters(context.search);
  const sameRole = (context.dynaRole ?? null) === agentRole;

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
    <aside className="flex flex-col gap-5 rounded-xl border border-default-200 p-4" aria-label="Gestión de la solicitud">
      <AppSelect
        label="Estado"
        size="sm"
        selectedKeys={[ticket.status]}
        disallowEmptySelection
        onSelectionChange={(keys) => {
          const key = Array.from(keys)[0];
          if (key) onStatus(key as TicketStatus);
        }}
      >
        {TICKET_STATUSES.map((s) => (
          <SelectItem key={s} className="cursor-pointer">
            {TICKET_STATUS[s].label}
          </SelectItem>
        ))}
      </AppSelect>
      <AppSelect
        label="Prioridad"
        size="sm"
        selectedKeys={[ticket.priority]}
        disallowEmptySelection
        onSelectionChange={(keys) => {
          const key = Array.from(keys)[0] as TicketPriority | undefined;
          if (key && key !== ticket.priority) save({ priority: key }, 'Prioridad actualizada');
        }}
      >
        {TICKET_PRIORITIES.map((p) => (
          <SelectItem key={p} className="cursor-pointer">
            {TICKET_PRIORITY[p].label}
          </SelectItem>
        ))}
      </AppSelect>

      <div className="flex flex-col gap-2">
        <Button variant="bordered" className="cursor-pointer" onPress={() => openContext(context)}>
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
              Ver como su rol
            </Button>
          </span>
        </Tooltip>
      </div>

      <section aria-label="Contexto">
        <h2 className="mb-3 text-sm font-semibold text-default-700">Contexto</h2>
        <dl className="flex flex-col gap-3">
          <Fact label="Solicitante">
            {ticket.requester.name ? `${ticket.requester.name} · ` : ''}
            {ticket.requester.email}
          </Fact>
          <Fact label="Pantalla">{context.pageTitle ? `${context.pageTitle} · ` : ''}{context.path}</Fact>
          {filters.length > 0 && (
            <Fact label="Filtros">
              <ul className="flex flex-col gap-0.5">
                {filters.map((f) => (
                  <li key={f.key}>
                    {f.key}: {f.value}
                  </li>
                ))}
              </ul>
            </Fact>
          )}
          {context.dateRange && (
            <Fact label="Fechas">{dateRangeText(context.dateRange)}</Fact>
          )}
          <Fact label="Rol en pantalla">{roleText(context.dynaRole, context.scope)}</Fact>
          <Fact label="Rol real">{getRoleLabel(context.realDynaRole) || 'Sin rol'}</Fact>
          {context.viewport && (
            <Fact label="Pantalla del navegador">
              {context.viewport.width} × {context.viewport.height}
            </Fact>
          )}
          {context.userAgent && <Fact label="Navegador">{context.userAgent}</Fact>}
        </dl>
      </section>

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
          <p className="text-sm text-default-600">Enviaremos un correo a {name} avisando de que está resuelta.</p>
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
