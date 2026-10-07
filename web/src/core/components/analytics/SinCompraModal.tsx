import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Tooltip,
  Input,
  Spinner,
  useDisclosure,
} from '@heroui/react';
import { EyeIcon, ArrowDownTrayIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { apiClient } from '@/core/api/client';
import { downloadExcel } from '@/core/api/downloadExcel';
import { useAuthStore } from '@/core/store/authStore';
import { canExport } from '@/core/config/access';

/** A customer without a purchase in the period, with the seller to follow up. */
export interface SinCompraRow {
  customer_id: string;
  customer_name: string;
  seller_id: string;
  seller_name: string;
}

interface SinCompraModalProps {
  /** Listing endpoint (e.g. `/api/balance/sin-compra`); its Excel export is `${endpoint}/export`. */
  endpoint: string;
  /** Period + merged filters, shared by the listing and the export. */
  params: URLSearchParams;
  /** Period shown in the export header (the window the "sin compra" refers to). */
  startDate: Date;
  endDate: Date;
  /** Context (board + drill), shown in the modal and the export title. */
  reportTitle: string;
  /** What the list contains, shown under the modal title. */
  description: string;
  /** Export file name prefix, e.g. "Festival_ClientesSinCompra". */
  filenamePrefix: string;
}

// Beyond this many rows the table is cut off — the search and the Excel
// export cover the long tail without degrading the modal.
const MAX_VISIBLE_ROWS = 300;

const fmtLongDate = (d: Date) => format(d, "d 'de' MMMM 'de' yyyy", { locale: es });

/**
 * Trigger + modal for a "Clientes sin compra" card (Festival and the analysis
 * boards): lists the customers (código, nombre, vendedor), searchable and
 * exportable to Excel. Data is fetched only when the modal opens.
 */
export function SinCompraModal({
  endpoint,
  params,
  startDate,
  endDate,
  reportTitle,
  description,
  filenamePrefix,
}: SinCompraModalProps) {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [search, setSearch] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const dynaRole = useAuthStore((s) => s.user?.dynaRole);

  const query = params.toString();
  const { data, isLoading } = useQuery({
    queryKey: ['sin-compra', endpoint, query],
    queryFn: () => apiClient<{ data: SinCompraRow[] }>(`${endpoint}?${query}`),
    enabled: isOpen,
  });
  const rows = useMemo(() => {
    const all = data?.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (r) =>
        r.customer_id.toLowerCase().includes(q) ||
        r.customer_name.toLowerCase().includes(q) ||
        r.seller_name.toLowerCase().includes(q)
    );
  }, [data, search]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const filename = `${filenamePrefix}_${format(startDate, 'yyyyMMdd')}-${format(endDate, 'yyyyMMdd')}`;
      const exportParams = new URLSearchParams(params);
      exportParams.set('reportTitle', `${reportTitle} · Clientes sin compra`);
      exportParams.set('periodLabel', `${fmtLongDate(startDate)} – ${fmtLongDate(endDate)}`);
      exportParams.set('generatedLabel', fmtLongDate(new Date()));
      exportParams.set('filename', filename);

      await downloadExcel(`${endpoint}/export`, exportParams, filename);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <Tooltip content="Ver quiénes son" placement="top">
        <Button
          isIconOnly
          size="sm"
          variant="bordered"
          className="border-1"
          aria-label="Ver quiénes son los clientes sin compra"
          onPress={onOpen}
        >
          <EyeIcon className="h-4 w-4 text-zinc-500" />
        </Button>
      </Tooltip>

      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="5xl" className="max-w-7xl">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                Clientes sin compra
                <span className="text-sm font-normal text-zinc-500">
                  {reportTitle} · {description}
                </span>
              </ModalHeader>
              <ModalBody>
                {isLoading ? (
                  <div className="flex justify-center py-16">
                    <Spinner label="Cargando clientes..." />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <Input
                        size="sm"
                        className="max-w-xs"
                        placeholder="Buscar por código, cliente o vendedor"
                        aria-label="Buscar cliente"
                        startContent={<MagnifyingGlassIcon className="h-4 w-4 text-zinc-400" />}
                        value={search}
                        onValueChange={setSearch}
                        isClearable
                      />
                      <span className="text-sm text-zinc-500 shrink-0">
                        {rows.length.toLocaleString('es-CO')} clientes
                      </span>
                    </div>
                    {rows.length === 0 ? (
                      <div className="text-sm text-zinc-400 py-10 text-center">Sin resultados</div>
                    ) : (
                      // The table scrolls in its own container so the sticky
                      // header sits flush at the top — sticking to the padded
                      // ModalBody left a gap where rows showed through.
                      <div className="overflow-y-auto max-h-[65vh]">
                        <table className="w-full text-left">
                          <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_theme(colors.zinc.200)]">
                            <tr className="text-xs font-semibold text-zinc-600 tracking-wider">
                              <th className="py-2 pr-4">NIT</th>
                              <th className="py-2 pr-4">CLIENTE</th>
                              <th className="py-2">VENDEDOR</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.slice(0, MAX_VISIBLE_ROWS).map((r) => (
                              <tr key={r.customer_id} className="border-b border-zinc-100 text-[13px]">
                                <td className="py-1.5 pr-4 font-mono text-zinc-500">{r.customer_id}</td>
                                <td className="py-1.5 pr-4 font-medium text-zinc-900">{r.customer_name}</td>
                                <td className="py-1.5 text-zinc-600">{r.seller_name}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {rows.length > MAX_VISIBLE_ROWS && (
                      <p className="text-xs text-zinc-400">
                        Mostrando {MAX_VISIBLE_ROWS} de {rows.length.toLocaleString('es-CO')} — usa el buscador o
                        exporta a Excel para ver el listado completo.
                      </p>
                    )}
                  </>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  Cerrar
                </Button>
                {canExport(dynaRole) && (
                  <Button
                    color="primary"
                    variant="flat"
                    startContent={!isExporting && <ArrowDownTrayIcon className="h-4 w-4" />}
                    isLoading={isExporting}
                    isDisabled={isLoading || (data?.data ?? []).length === 0}
                    onPress={handleExport}
                  >
                    Exportar a Excel
                  </Button>
                )}
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
