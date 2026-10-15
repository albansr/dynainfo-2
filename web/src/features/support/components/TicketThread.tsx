import { useState } from 'react';
import { Button, Switch, Textarea } from '@heroui/react';
import { toast } from 'sonner';
import { DESCRIPTION_MAX } from '../config/support';
import { useAddMessage, type TicketDetail, type TicketMessage } from '../hooks/useSupport';
import { useSupportDrawerStore } from '../store/supportDrawerStore';
import { formatDateTime } from '../utils/relativeTime';

interface Bubble {
  key: string;
  author: string;
  body: string;
  createdAt: string;
  fromTeam: boolean;
  internal: boolean;
}

function author(message: TicketMessage, requesterName: string): string {
  if (!message.authorIsAgent) return requesterName;
  return message.authorName ?? 'Equipo DynaInfo';
}

function MessageBubble({ bubble }: { bubble: Bubble }) {
  const tone = bubble.internal
    ? 'bg-warning-50 border-warning-200'
    : bubble.fromTeam
      ? 'bg-default-50 border-default-200'
      : 'bg-white border-default-200';
  return (
    <li className={`rounded-xl border p-4 ${tone}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-default-500">
        <span className="font-semibold text-default-700">{bubble.author}</span>
        {bubble.internal && <span className="font-semibold text-warning-700">Nota interna</span>}
        <time dateTime={bubble.createdAt}>{formatDateTime(bubble.createdAt)}</time>
      </div>
      <p className="whitespace-pre-wrap text-sm text-foreground">{bubble.body}</p>
    </li>
  );
}

/** The request thread (description first) and the reply box. */
export function TicketThread({ ticket, isAgent }: { ticket: TicketDetail; isAgent: boolean }) {
  const requesterName = ticket.requester.name ?? ticket.requester.email;
  const bubbles: Bubble[] = [
    { key: 'description', author: requesterName, body: ticket.description, createdAt: ticket.createdAt, fromTeam: false, internal: false },
    ...ticket.messages.map((m) => ({
      key: m.id,
      author: author(m, requesterName),
      body: m.body,
      createdAt: m.createdAt,
      fromTeam: m.authorIsAgent,
      internal: m.internal,
    })),
  ];

  return (
    <section className="flex flex-col gap-4" aria-label="Conversación">
      <ol className="flex flex-col gap-3">
        {bubbles.map((bubble) => (
          <MessageBubble key={bubble.key} bubble={bubble} />
        ))}
      </ol>
      {ticket.status === 'closed' ? <ClosedNotice /> : <ReplyBox ticket={ticket} isAgent={isAgent} />}
    </section>
  );
}

function ClosedNotice() {
  const openDrawer = useSupportDrawerStore((s) => s.open);
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-default-200 bg-default-50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-default-600">Esta solicitud está cerrada. Si el problema sigue, abre una nueva solicitud.</p>
      <Button size="sm" variant="bordered" className="cursor-pointer" onPress={openDrawer}>
        Nueva solicitud
      </Button>
    </div>
  );
}

function ReplyBox({ ticket, isAgent }: { ticket: TicketDetail; isAgent: boolean }) {
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const addMessage = useAddMessage(ticket.number);

  const send = () => {
    addMessage.mutate(
      { body: body.trim(), internal: isAgent && internal },
      {
        onSuccess: () => {
          setBody('');
          toast.success(internal ? 'Nota interna guardada' : 'Respuesta enviada');
        },
        onError: () => toast.error('No pudimos enviar la respuesta. Inténtalo de nuevo.'),
      },
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {!isAgent && ticket.status === 'resolved' && (
        <p className="text-sm text-default-500">Si respondes, reabriremos la solicitud.</p>
      )}
      <Textarea
        aria-label="Respuesta"
        variant="bordered"
        minRows={3}
        maxLength={DESCRIPTION_MAX}
        placeholder="Escribe una respuesta…"
        value={body}
        onValueChange={setBody}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        {isAgent ? (
          <Switch size="sm" isSelected={internal} onValueChange={setInternal} classNames={{ base: 'cursor-pointer' }}>
            Nota interna (no la ve el usuario)
          </Switch>
        ) : (
          <span />
        )}
        <Button
          color="primary"
          className="cursor-pointer"
          isDisabled={!body.trim()}
          isLoading={addMessage.isPending}
          onPress={send}
        >
          Enviar
        </Button>
      </div>
    </div>
  );
}
