import { useLocation, useNavigate } from 'react-router-dom';
import { Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter, Button, Link } from '@heroui/react';
import { toast } from 'sonner';
import { useAuthStore } from '@/core/store/authStore';
import { useDateRangeStore } from '@/core/store/dateRangeStore';
import { ticketSubject } from '../config/support';
import { useCreateTicket } from '../hooks/useSupport';
import { useSupportDrawerStore, isDraftValid, wantsScreenshot } from '../store/supportDrawerStore';
import { captureContext } from '../utils/supportContext';
import { describeContext } from '../utils/describeContext';
import { SUPPORT_IGNORE_CLASS } from '../utils/captureScreenshot';
import { NewTicketForm } from './NewTicketForm';

/**
 * "Ayuda y soporte" drawer with the new-request form. Mounted once in the app
 * layout. The screenshot is taken when it opens (the drawer itself is left out),
 * so it shows what the user was looking at.
 */
export function SupportDrawer() {
  const { isOpen, draft, screenshot, open, close, reset } = useSupportDrawerStore();
  const location = useLocation();
  const navigate = useNavigate();
  const createTicket = useCreateTicket();
  const valid = isDraftValid(draft);
  const capturing = wantsScreenshot(draft) && screenshot.status === 'capturing';

  const send = () => {
    if (!isDraftValid(draft) || createTicket.isPending || capturing) return;
    const { startDate, endDate, preset } = useDateRangeStore.getState();
    const context = captureContext({
      location,
      dateRange: { startDate, endDate, preset },
      user: useAuthStore.getState().user,
      pageTitle: document.title,
      userAgent: navigator.userAgent,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    });
    const withScreenshot = wantsScreenshot(draft) && screenshot.status === 'ready';

    createTicket.mutate(
      {
        type: draft.type,
        subject: ticketSubject(draft.subject, draft.description),
        description: draft.description.trim(),
        context: { ...context, summary: describeContext(context) },
        ...(withScreenshot ? { screenshot: screenshot.base64 } : {}),
      },
      {
        onSuccess: ({ number }) => {
          close();
          reset();
          toast.success(`Solicitud #${number} enviada. Te avisaremos por correo.`, {
            action: { label: 'Ver', onClick: () => navigate(`/soporte/${number}`) },
          });
        },
        onError: () => toast.error('No pudimos enviar la solicitud. Inténtalo de nuevo.'),
      },
    );
  };

  return (
    <Drawer
      isOpen={isOpen}
      onOpenChange={(next) => (next ? open() : close())}
      placement="right"
      size="md"
      classNames={{ wrapper: SUPPORT_IGNORE_CLASS, backdrop: SUPPORT_IGNORE_CLASS }}
    >
      <DrawerContent>
        <DrawerHeader className="flex flex-col gap-1">
          <span>Ayuda y soporte</span>
          <span className="text-sm font-normal text-default-500">
            Cuéntanos qué pasa. Guardamos la pantalla, los filtros y las fechas que estás viendo.
          </span>
        </DrawerHeader>
        <DrawerBody>
          <NewTicketForm onSubmit={send} />
        </DrawerBody>
        <DrawerFooter className="flex items-center justify-between">
          <Link
            className="cursor-pointer text-sm"
            onPress={() => {
              close();
              navigate('/soporte');
            }}
          >
            Ver mis solicitudes
          </Link>
          <Button
            color={valid ? 'primary' : 'default'}
            variant={valid ? 'solid' : 'flat'}
            className="cursor-pointer"
            isLoading={createTicket.isPending}
            onPress={() => {
              if (!valid) toast('Elige el tipo y cuéntanos qué pasa (al menos 10 caracteres).');
              else send();
            }}
          >
            {capturing ? 'Preparando captura…' : 'Enviar solicitud'}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
