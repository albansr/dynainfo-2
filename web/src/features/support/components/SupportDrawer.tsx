import { useLocation, useNavigate } from 'react-router-dom';
import { Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter, Button, Link, Tooltip } from '@heroui/react';
import { toast } from 'sonner';
import { useAuthStore } from '@/core/store/authStore';
import { useDateRangeStore } from '@/core/store/dateRangeStore';
import { useCreateTicket } from '../hooks/useSupport';
import { useSupportDrawerStore, isDraftValid, wantsScreenshot } from '../store/supportDrawerStore';
import { captureContext } from '../utils/supportContext';
import { captureScreenshot, SUPPORT_IGNORE_ATTR } from '../utils/captureScreenshot';
import { NewTicketForm } from './NewTicketForm';

/** Time for the drawer's exit animation before the screen is captured. */
const DRAWER_EXIT_MS = 400;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * "Ayuda y soporte" drawer with the new-request form. Mounted once in the app
 * layout, so sending survives the drawer closing: it closes first (so it never
 * appears in the screenshot), then captures and sends, with toasts for progress.
 */
export function SupportDrawer() {
  const { isOpen, draft, open, close, resetDraft } = useSupportDrawerStore();
  const location = useLocation();
  const navigate = useNavigate();
  const createTicket = useCreateTicket();
  const valid = isDraftValid(draft);

  const send = async () => {
    if (!isDraftValid(draft)) return;
    const { startDate, endDate, preset } = useDateRangeStore.getState();
    const context = captureContext({
      location,
      dateRange: { startDate, endDate, preset },
      user: useAuthStore.getState().user,
      pageTitle: document.title,
      userAgent: navigator.userAgent,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    });
    const withScreenshot = wantsScreenshot(draft);

    close();
    const toastId = toast.loading('Enviando solicitud…');
    try {
      let screenshot: string | null = null;
      if (withScreenshot) {
        await wait(DRAWER_EXIT_MS);
        screenshot = await captureScreenshot();
        if (!screenshot) toast.warning('No pudimos adjuntar la captura. Enviamos la solicitud sin ella.');
      }
      const { number } = await createTicket.mutateAsync({
        type: draft.type,
        subject: draft.subject.trim(),
        description: draft.description.trim(),
        context,
        ...(screenshot ? { screenshot } : {}),
      });
      resetDraft();
      toast.success(`Solicitud #${number} enviada. Te avisaremos por correo.`, {
        id: toastId,
        action: { label: 'Ver', onClick: () => navigate(`/soporte/${number}`) },
      });
    } catch {
      toast.error('No pudimos enviar la solicitud. Inténtalo de nuevo.', { id: toastId });
      open();
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onOpenChange={(next) => (next ? open() : close())}
      placement="right"
      size="md"
    >
      <DrawerContent {...{ [SUPPORT_IGNORE_ATTR]: '' }}>
        <DrawerHeader className="flex flex-col gap-1">
          <span>Ayuda y soporte</span>
          <span className="text-sm font-normal text-default-500">
            Cuéntanos qué pasa. Guardamos automáticamente la pantalla, los filtros y las fechas que estás viendo.
          </span>
        </DrawerHeader>
        <DrawerBody>
          <NewTicketForm />
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
          <Tooltip content="Completa el tipo, el asunto y la descripción" isDisabled={valid}>
            <span>
              <Button color="primary" className="cursor-pointer" isDisabled={!valid} onPress={() => void send()}>
                Enviar solicitud
              </Button>
            </span>
          </Tooltip>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
