import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, SelectItem, Tab, Tabs } from '@heroui/react';
import { PageHeader } from '@/core/components/PageHeader';
import { AppSelect } from '@/core/components/AppSelect';
import { useAuthStore, selectIsSupportAgent } from '@/core/store/authStore';
import {
  STATUS_FILTER_LABEL,
  TICKET_PRIORITIES,
  TICKET_PRIORITY,
  TICKET_STATUS,
  TICKET_TYPE,
  TICKET_TYPES,
  type StatusFilter,
  type TicketPriority,
  type TicketType,
} from '../config/support';
import { useSupportTickets, type TicketListParams } from '../hooks/useSupport';
import { useSupportDrawerStore } from '../store/supportDrawerStore';
import { TicketList } from '../components/TicketList';
import { DotLabel } from '../components/TicketChips';

const STATUS_FILTERS: StatusFilter[] = ['active', 'open', 'in_progress', 'resolved', 'closed', 'all'];
const ALL = 'all';

/** /soporte: "Mis solicitudes" for everyone; agents also get "Todas" with filters. */
export function SupportPage() {
  const isAgent = useAuthStore(selectIsSupportAgent);
  // Simulating ADMIN (demo role) shows the admin UI elsewhere, but support needs the real role
  const simulatesAdmin = useAuthStore((s) => s.user?.dynaRole === 'ADMIN') && !isAgent;
  const openDrawer = useSupportDrawerStore((s) => s.open);
  // null until the user picks a tab: agents default to "Todas" (or "Mis solicitudes"
  // from the help menu, ?ver=mias) once the real role is known (it arrives with the
  // session, after the first render). Following a link resets the choice.
  const [searchParams] = useSearchParams();
  const linkedScope = searchParams.get('ver') === 'mias' ? 'mine' : 'all';
  const [scope, setScope] = useState<'mine' | 'all' | null>(null);
  const [prevLinkedScope, setPrevLinkedScope] = useState(linkedScope);
  if (linkedScope !== prevLinkedScope) {
    setPrevLinkedScope(linkedScope);
    setScope(null);
  }
  const [status, setStatus] = useState<StatusFilter>('active');
  const [type, setType] = useState<TicketType | null>(null);
  const [priority, setPriority] = useState<TicketPriority | null>(null);
  const [page, setPage] = useState(1);

  const effectiveScope = isAgent ? (scope ?? linkedScope) : 'mine';
  const params: TicketListParams =
    effectiveScope === 'all'
      ? { scope: 'all', status, type, priority, page }
      : { scope: 'mine', status: 'all', type: null, priority: null, page };
  const { data, isLoading, isError, refetch } = useSupportTickets(params);
  const filtered = effectiveScope === 'all' && (status !== 'all' || type !== null || priority !== null);

  // Any filter change goes back to the first page
  const filter = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  return (
    <div>
      <PageHeader
        title={effectiveScope === 'all' ? 'Solicitudes' : 'Mis solicitudes'}
        showDateFilter={false}
        subtitle={effectiveScope === 'all' ? 'Todas las solicitudes de soporte de DynaInfo' : 'Tus solicitudes de soporte y sus respuestas'}
        leadingControl={
          <Button color="primary" className="cursor-pointer" onPress={() => openDrawer()}>
            Nueva solicitud
          </Button>
        }
      />

      {simulatesAdmin && (
        <p className="mb-4 rounded-lg bg-default-100 p-3 text-sm text-default-600">
          Estás simulando el rol Admin. Para gestionar las solicitudes de todos necesitas el rol Admin real o ser superadmin;
          aquí ves solo las tuyas.
        </p>
      )}

      {isAgent && (
        <Tabs
          aria-label="Solicitudes"
          selectedKey={effectiveScope}
          onSelectionChange={(key) => filter(setScope)(key as 'mine' | 'all')}
          classNames={{ tab: 'cursor-pointer' }}
          className="mb-4"
        >
          <Tab key="all" title="Todas" />
          <Tab key="mine" title="Mis solicitudes" />
        </Tabs>
      )}

      {effectiveScope === 'all' && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <AppSelect
            label="Estado"
            size="sm"
            selectedKeys={[status]}
            disallowEmptySelection
            onSelectionChange={(keys) => filter(setStatus)((Array.from(keys)[0] as StatusFilter | undefined) ?? 'active')}
          >
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s} textValue={STATUS_FILTER_LABEL[s]} className="cursor-pointer">
                {s === 'active' || s === 'all' ? STATUS_FILTER_LABEL[s] : <DotLabel {...TICKET_STATUS[s]} />}
              </SelectItem>
            ))}
          </AppSelect>
          <AppSelect
            label="Tipo"
            size="sm"
            selectedKeys={[type ?? ALL]}
            disallowEmptySelection
            onSelectionChange={(keys) => {
              const key = Array.from(keys)[0] as string | undefined;
              filter(setType)(key && key !== ALL ? (key as TicketType) : null);
            }}
          >
            {[
              <SelectItem key={ALL} className="cursor-pointer">Todos</SelectItem>,
              ...TICKET_TYPES.map((t) => (
                <SelectItem key={t} className="cursor-pointer">
                  {TICKET_TYPE[t].label}
                </SelectItem>
              )),
            ]}
          </AppSelect>
          <AppSelect
            label="Prioridad"
            size="sm"
            selectedKeys={[priority ?? ALL]}
            disallowEmptySelection
            onSelectionChange={(keys) => {
              const key = Array.from(keys)[0] as string | undefined;
              filter(setPriority)(key && key !== ALL ? (key as TicketPriority) : null);
            }}
          >
            {[
              <SelectItem key={ALL} className="cursor-pointer">Todas</SelectItem>,
              ...TICKET_PRIORITIES.map((p) => (
                <SelectItem key={p} textValue={TICKET_PRIORITY[p].label} className="cursor-pointer">
                  <DotLabel {...TICKET_PRIORITY[p]} />
                </SelectItem>
              )),
            ]}
          </AppSelect>
        </div>
      )}

      {isError ? (
        <div className="flex flex-col items-start gap-3 py-8">
          <p className="text-sm text-danger">No pudimos cargar las solicitudes.</p>
          <Button size="sm" variant="bordered" className="cursor-pointer" onPress={() => void refetch()}>
            Reintentar
          </Button>
        </div>
      ) : (
        <TicketList
          tickets={data?.data ?? []}
          total={data?.total ?? 0}
          page={page}
          onPageChange={setPage}
          showAgentColumns={effectiveScope === 'all'}
          isLoading={isLoading}
          emptyContent={
            filtered
              ? 'No hay solicitudes con estos filtros.'
              : 'Aún no has enviado solicitudes. Si algo no funciona o no cuadra, cuéntanoslo desde «Ayuda y soporte».'
          }
        />
      )}
    </div>
  );
}
