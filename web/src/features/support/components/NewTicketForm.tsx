import { Accordion, AccordionItem, Checkbox, Input, Radio, RadioGroup, Textarea } from '@heroui/react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '@/core/store/authStore';
import { useDateRange } from '@/core/hooks/useDateRange';
import { getRoleLabel } from '@/core/config/access';
import { DESCRIPTION_MAX, SUBJECT_MAX, TICKET_TYPE, TICKET_TYPES, type TicketType } from '../config/support';
import { useSupportDrawerStore, wantsScreenshot } from '../store/supportDrawerStore';
import { contextFilters } from '../utils/supportContext';

/** The new-request form; its values live in the drawer store (kept if sending fails). */
export function NewTicketForm() {
  const { draft, updateDraft } = useSupportDrawerStore();
  const location = useLocation();
  const { formattedRange } = useDateRange();
  const user = useAuthStore((s) => s.user);
  const filters = contextFilters(location.search);

  return (
    <div className="flex flex-col gap-5">
      <RadioGroup
        label="Tipo"
        isRequired
        value={draft.type ?? ''}
        onValueChange={(value) => updateDraft({ type: value as TicketType })}
      >
        {TICKET_TYPES.map((type) => (
          <Radio key={type} value={type} description={TICKET_TYPE[type].hint} classNames={{ base: 'cursor-pointer' }}>
            {TICKET_TYPE[type].label}
          </Radio>
        ))}
      </RadioGroup>

      <Input
        label="Asunto"
        labelPlacement="outside"
        variant="bordered"
        isRequired
        maxLength={SUBJECT_MAX}
        placeholder="Ej.: No sale el presupuesto en proveedores"
        value={draft.subject}
        onValueChange={(subject) => updateDraft({ subject })}
      />

      <Textarea
        label="Descripción"
        labelPlacement="outside"
        variant="bordered"
        isRequired
        minRows={4}
        maxLength={DESCRIPTION_MAX}
        placeholder="Qué esperabas ver y qué ves en su lugar"
        value={draft.description}
        onValueChange={(description) => updateDraft({ description })}
      />

      <Checkbox
        isSelected={wantsScreenshot(draft)}
        onValueChange={(includeScreenshot) => updateDraft({ includeScreenshot })}
        classNames={{ base: 'cursor-pointer' }}
      >
        Incluir captura de pantalla
      </Checkbox>

      <Accordion isCompact variant="light" className="px-0">
        <AccordionItem key="context" aria-label="Qué se envía" title="Qué se envía" classNames={{ trigger: 'cursor-pointer', title: 'text-sm' }}>
          <ul className="flex flex-col gap-1 text-sm text-default-600">
            <li>Pantalla: {location.pathname}</li>
            <li>Fechas: {formattedRange}</li>
            {filters.length > 0 && <li>Filtros: {filters.map((f) => `${f.key}: ${f.value}`).join(' · ')}</li>}
            <li>
              Rol: {getRoleLabel(user?.dynaRole) || 'Sin rol'}
              {user?.scope ? ` · ${user.scope}` : ''}
            </li>
            <li>Navegador y tamaño de pantalla</li>
          </ul>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
