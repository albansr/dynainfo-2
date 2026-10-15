import { Button, Tooltip } from '@heroui/react';
import { FlagIcon } from '@heroicons/react/24/outline';
import { useSupportDrawerStore } from '../store/supportDrawerStore';
import { dataReportDraft } from '../utils/dataReport';

interface ReportDataButtonProps {
  /** What the figure is ("CUMPL. PRESUPUESTO", "Tabla por Proveedor"). */
  metric: string;
  /** The value shown, when it is plain text. */
  value?: string;
  /** `icon`: a small flag (cards, visible on hover/focus); `link`: a text link (tables). */
  variant?: 'icon' | 'link';
}

/** "¿Este dato no cuadra?": opens Ayuda y soporte as "Dato incorrecto", pre-filled with the figure. */
export function ReportDataButton({ metric, value, variant = 'icon' }: ReportDataButtonProps) {
  const open = useSupportDrawerStore((s) => s.open);
  const report = () => open(dataReportDraft(metric, value));

  if (variant === 'link') {
    return (
      <Button size="sm" variant="light" className="cursor-pointer text-default-500" startContent={<FlagIcon className="h-4 w-4" />} onPress={report}>
        ¿Algún dato no cuadra?
      </Button>
    );
  }
  return (
    <Tooltip content="¿Este dato no cuadra?" placement="top">
      <button
        type="button"
        onClick={report}
        aria-label={`¿Este dato no cuadra? ${metric}`}
        className="cursor-pointer rounded p-0.5 text-zinc-400 opacity-0 transition-opacity hover:text-zinc-700 focus:opacity-100 group-hover:opacity-100"
      >
        <FlagIcon className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </Tooltip>
  );
}
