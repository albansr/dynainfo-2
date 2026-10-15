import { Accordion, AccordionItem, Checkbox, Input, Radio, RadioGroup, Skeleton, Textarea } from '@heroui/react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '@/core/store/authStore';
import { useDateRange } from '@/core/hooks/useDateRange';
import { DESCRIPTION_MAX, SUBJECT_MAX, TICKET_TYPE, TICKET_TYPES, type TicketType } from '../config/support';
import { useSupportDrawerStore, wantsScreenshot } from '../store/supportDrawerStore';
import { describeContext } from '../utils/describeContext';
import { isSubmitShortcut, SUBMIT_SHORTCUT_HINT } from '../utils/keyboard';

function ScreenshotPreview() {
  const screenshot = useSupportDrawerStore((s) => s.screenshot);
  if (screenshot.status === 'capturing') {
    return <Skeleton className="h-28 w-full rounded-lg" aria-label="Preparando captura" />;
  }
  if (screenshot.status === 'failed') {
    return <p className="text-xs text-default-500">No pudimos hacer la captura de esta pantalla. Puedes enviar la solicitud sin ella.</p>;
  }
  if (screenshot.status !== 'ready') return null;
  return (
    <img
      src={`data:image/jpeg;base64,${screenshot.base64}`}
      alt="Captura de la pantalla que se enviará"
      className="h-auto max-h-48 w-full rounded-lg border border-default-200 object-cover object-top"
    />
  );
}

/** The new-request form; its values live in the drawer store (kept if sending fails). */
export function NewTicketForm({ onSubmit }: { onSubmit: () => void }) {
  const { draft, updateDraft } = useSupportDrawerStore();
  const location = useLocation();
  const { startDate, endDate, preset } = useDateRange();
  const user = useAuthStore((s) => s.user);
  const type = draft.type ? TICKET_TYPE[draft.type] : null;
  const summary = describeContext({
    path: location.pathname,
    search: location.search,
    dateRange: { start: startDate.toISOString(), end: endDate.toISOString(), preset },
    dynaRole: user?.dynaRole ?? null,
    scope: user?.scope ?? null,
  });

  return (
    <div className="flex flex-col gap-5">
      <RadioGroup
        label="¿Qué pasa?"
        isRequired
        value={draft.type ?? ''}
        onValueChange={(value) => updateDraft({ type: value as TicketType })}
        classNames={{ wrapper: 'grid grid-cols-2 gap-2' }}
      >
        {TICKET_TYPES.map((key) => {
          const { label, hint, icon: Icon } = TICKET_TYPE[key];
          return (
            <Radio
              key={key}
              value={key}
              classNames={{
                base: 'm-0 max-w-none cursor-pointer items-start rounded-xl border border-default-200 p-3 data-[selected=true]:border-primary data-[selected=true]:bg-primary-50',
                wrapper: 'hidden',
                labelWrapper: 'm-0',
              }}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <Icon className="h-4 w-4 text-default-500" aria-hidden="true" />
                {label}
              </span>
              <span className="mt-0.5 block text-xs text-default-500">{hint}</span>
            </Radio>
          );
        })}
      </RadioGroup>

      <Textarea
        label={type?.prompt ?? 'Cuéntanos qué pasa'}
        labelPlacement="outside"
        variant="bordered"
        isRequired
        minRows={4}
        maxLength={DESCRIPTION_MAX}
        placeholder={type?.placeholder ?? 'Qué esperabas ver y qué ves en su lugar'}
        value={draft.description}
        onValueChange={(description) => updateDraft({ description })}
        onKeyDown={(e) => {
          if (isSubmitShortcut(e)) onSubmit();
        }}
        description={SUBMIT_SHORTCUT_HINT}
      />

      <Input
        label="Asunto (opcional)"
        labelPlacement="outside"
        variant="bordered"
        maxLength={SUBJECT_MAX}
        placeholder="Si lo dejas vacío, usamos la primera línea"
        value={draft.subject}
        onValueChange={(subject) => updateDraft({ subject })}
      />

      <div className="flex flex-col gap-2">
        <Checkbox
          isSelected={wantsScreenshot(draft)}
          onValueChange={(includeScreenshot) => updateDraft({ includeScreenshot })}
          classNames={{ base: 'cursor-pointer' }}
        >
          Incluir captura de pantalla
        </Checkbox>
        {wantsScreenshot(draft) && <ScreenshotPreview />}
      </div>

      <Accordion isCompact variant="light" className="px-0">
        <AccordionItem
          key="context"
          aria-label="Qué se envía"
          title="Qué se envía"
          classNames={{ trigger: 'cursor-pointer', title: 'text-sm' }}
        >
          <dl className="flex flex-col gap-1 text-sm">
            <div className="flex gap-2">
              <dt className="text-default-500">Pantalla:</dt>
              <dd>{summary.page}</dd>
            </div>
            {summary.items.map((item) => (
              <div key={item.label} className="flex gap-2">
                <dt className="text-default-500">{item.label}:</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
            <div className="text-default-500">Y el navegador y el tamaño de pantalla.</div>
          </dl>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
