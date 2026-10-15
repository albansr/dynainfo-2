import { Button } from '@heroui/react';
import type { TicketDetail } from '../hooks/useSupport';
import { useOpenTicketContext } from '../hooks/useOpenTicketContext';
import { ContextFacts } from './ContextFacts';
import { ScreenshotPreview } from './ScreenshotPreview';

/** Requester's side card: what was sent with the request, and a way back to that screen. */
export function SubmittedContextCard({ ticket }: { ticket: TicketDetail }) {
  const openContext = useOpenTicketContext();
  return (
    <aside className="flex flex-col gap-4 rounded-xl border border-default-200 p-4" aria-label="Lo que enviaste">
      <h2 className="text-sm font-semibold text-default-700">Lo que enviaste</h2>
      {ticket.hasScreenshot && <ScreenshotPreview number={ticket.number} />}
      <ContextFacts context={ticket.context} />
      {ticket.context.path && (
        <Button size="sm" variant="bordered" className="cursor-pointer" onPress={() => openContext(ticket.context)}>
          Abrir esa pantalla
        </Button>
      )}
    </aside>
  );
}
