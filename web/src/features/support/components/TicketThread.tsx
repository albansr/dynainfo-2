import { forwardRef, useState } from 'react';
import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Switch, Textarea, Tooltip } from '@heroui/react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { DESCRIPTION_MAX, QUICK_REPLIES } from '../config/support';
import { useAddMessage, type TicketDetail, type TicketMessage } from '../hooks/useSupport';
import { useSupportDrawerStore } from '../store/supportDrawerStore';
import { formatDateTime, formatRelative } from '../utils/relativeTime';
import { isSubmitShortcut, SUBMIT_SHORTCUT_HINT } from '../utils/keyboard';

interface Bubble {
  key: string;
  author: string;
  label?: string;
  body: string;
  createdAt: string;
  /** Written by whoever is looking (right-aligned). */
  mine: boolean;
  internal: boolean;
}

function toBubbles(ticket: TicketDetail, isAgent: boolean): Bubble[] {
  const requesterName = ticket.requester.name ?? ticket.requester.email;
  const author = (m: TicketMessage) => (m.authorIsAgent ? (m.authorName ?? 'Equipo DynaInfo') : requesterName);
  return [
    {
      key: 'description',
      author: requesterName,
      label: isAgent ? 'Solicitud' : 'Tu solicitud',
      body: ticket.description,
      createdAt: ticket.createdAt,
      mine: !isAgent,
      internal: false,
    },
    ...ticket.messages.map((m) => ({
      key: m.id,
      author: author(m),
      body: m.body,
      createdAt: m.createdAt,
      mine: isAgent ? m.authorIsAgent : !m.authorIsAgent,
      internal: m.internal,
    })),
  ];
}

function MessageBubble({ bubble }: { bubble: Bubble }) {
  const tone = bubble.internal
    ? 'border-warning-200 bg-warning-50'
    : bubble.mine
      ? 'border-primary-100 bg-primary-50'
      : 'border-default-200 bg-white';
  return (
    <li className={`flex ${bubble.internal ? 'justify-stretch' : bubble.mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`rounded-2xl border px-4 py-3 ${tone} ${bubble.internal ? 'w-full' : 'max-w-[85%]'}`}>
        <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-default-500">
          <span className="font-semibold text-default-700">{bubble.author}</span>
          {bubble.label && <span className="font-medium text-primary-700">{bubble.label}</span>}
          {bubble.internal && <span className="font-semibold text-warning-700">Nota interna</span>}
          <Tooltip content={formatDateTime(bubble.createdAt)} placement="top">
            <time dateTime={bubble.createdAt} className="cursor-default">
              {formatRelative(bubble.createdAt)}
            </time>
          </Tooltip>
        </div>
        <p className="whitespace-pre-wrap text-sm text-foreground">{bubble.body}</p>
      </div>
    </li>
  );
}

/** The request as a conversation (yours on the right, the other side on the left) and the reply box. */
export const TicketThread = forwardRef<HTMLTextAreaElement, { ticket: TicketDetail; isAgent: boolean }>(
  function TicketThread({ ticket, isAgent }, composerRef) {
    return (
      <section className="flex flex-col gap-4" aria-label="Conversación">
        <ol className="flex flex-col gap-3">
          {toBubbles(ticket, isAgent).map((bubble) => (
            <MessageBubble key={bubble.key} bubble={bubble} />
          ))}
        </ol>
        {ticket.status === 'closed' ? (
          <ClosedNotice />
        ) : (
          <Composer ref={composerRef} ticket={ticket} isAgent={isAgent} />
        )}
      </section>
    );
  },
);

function ClosedNotice() {
  const openDrawer = useSupportDrawerStore((s) => s.open);
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-default-200 bg-default-50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-default-600">Esta solicitud está cerrada. Si el problema sigue, abre una nueva solicitud.</p>
      <Button size="sm" variant="bordered" className="cursor-pointer" onPress={() => openDrawer()}>
        Nueva solicitud
      </Button>
    </div>
  );
}

/** Reply box (3 lines, grows while writing), Ctrl/⌘ + Enter sends; agents get quick replies, internal notes and "Enviar y resolver". */
const Composer = forwardRef<HTMLTextAreaElement, { ticket: TicketDetail; isAgent: boolean }>(function Composer(
  { ticket, isAgent },
  ref,
) {
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const addMessage = useAddMessage(ticket.number);
  const hasText = body.trim().length > 0;

  const send = (resolve = false) => {
    if (!hasText || addMessage.isPending) return;
    addMessage.mutate(
      { body: body.trim(), internal: isAgent && internal, ...(resolve ? { resolve: true } : {}) },
      {
        onSuccess: () => {
          setBody('');
          toast.success(resolve ? 'Respuesta enviada y solicitud resuelta' : internal ? 'Nota interna guardada' : 'Respuesta enviada');
        },
        onError: () => toast.error('No pudimos enviar la respuesta. Inténtalo de nuevo.'),
      },
    );
  };

  return (
    <div id="responder" className="flex scroll-mt-24 flex-col gap-2">
      {!isAgent && ticket.status === 'resolved' && (
        <p className="text-sm text-default-500">Si respondes, reabriremos la solicitud.</p>
      )}
      <Textarea
        ref={ref}
        aria-label={internal ? 'Nota interna' : 'Respuesta'}
        variant="bordered"
        minRows={3}
        maxRows={12}
        maxLength={DESCRIPTION_MAX}
        placeholder={internal ? 'Nota interna para el equipo…' : 'Escribe una respuesta…'}
        value={body}
        onValueChange={setBody}
        onKeyDown={(e) => {
          if (isSubmitShortcut(e)) send();
        }}
        description={hasText ? SUBMIT_SHORTCUT_HINT : undefined}
        classNames={internal ? { inputWrapper: 'bg-warning-50' } : undefined}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        {isAgent ? (
          <div className="flex flex-wrap items-center gap-3">
            <Dropdown>
              <DropdownTrigger>
                <Button size="sm" variant="light" className="cursor-pointer" endContent={<ChevronDownIcon className="h-4 w-4" />}>
                  Respuestas rápidas
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="Respuestas rápidas"
                onAction={(key) => setBody(QUICK_REPLIES.find((r) => r.key === key)?.text ?? body)}
              >
                {QUICK_REPLIES.map((reply) => (
                  <DropdownItem key={reply.key} description={reply.text} className="cursor-pointer">
                    {reply.label}
                  </DropdownItem>
                ))}
              </DropdownMenu>
            </Dropdown>
            <Switch size="sm" isSelected={internal} onValueChange={setInternal} classNames={{ base: 'cursor-pointer' }}>
              Nota interna (no la ve el usuario)
            </Switch>
          </div>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          {isAgent && !internal && ticket.status !== 'resolved' && (
            <Button variant="bordered" className="cursor-pointer" isDisabled={!hasText} onPress={() => send(true)}>
              Enviar y resolver
            </Button>
          )}
          <Button
            color={hasText ? 'primary' : 'default'}
            variant={hasText ? 'solid' : 'flat'}
            className="cursor-pointer"
            isDisabled={!hasText}
            isLoading={addMessage.isPending}
            onPress={() => send()}
          >
            {internal ? 'Guardar nota' : 'Enviar'}
          </Button>
        </div>
      </div>
    </div>
  );
});
