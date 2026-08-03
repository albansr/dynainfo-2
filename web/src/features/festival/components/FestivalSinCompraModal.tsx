import { useMemo, useState } from 'react';
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
import { useFestivalSinCompra, useMergedFilters } from '../hooks/useFestivalBalance';
import { downloadExcel, appendFilterParams } from '../utils/downloadExcel';

interface FestivalSinCompraModalProps {
  /** Event window (the comparison window is irrelevant to this listing). */
  startDate: Date;
  endDate: Date;
  /** Accumulated drill filters (role filters are merged automatically). */
  filters: Record<string, unknown>;
  /** Festival + drill context, shown in the modal and the export title. */
  reportTitle: string;
}

// Beyond this many rows the table is cut off — the search and the Excel
// export cover the long tail without degrading the modal.
const MAX_VISIBLE_ROWS = 300;

const fmtLongDate = (d: Date) => format(d, "d 'de' MMMM 'de' yyyy", { locale: es });

/**
 * Trigger + modal for the "Clientes sin compra" card: lists the active-year
 * customers without a festival purchase (código, nombre, vendedor), searchable
 * and exportable to Excel. Data is fetched only when the modal opens.
 */
export function FestivalSinCompraModal({ startDate, endDate, filters, reportTitle }: FestivalSinCompraModalProps) {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [search, setSearch] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const mergedFilters = useMergedFilters(filters);

  const { data, isLoading } = useFestivalSinCompra({ startDate, endDate }, filters, isOpen);
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
      const params = new URLSearchParams({
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        reportTitle: `${reportTitle} · Clientes sin compra`,
        periodLabel: `${fmtLongDate(startDate)} – ${fmtLongDate(endDate)}`,
        generatedLabel: fmtLongDate(new Date()),
      });
      const filename = `Festival_ClientesSinCompra_${format(startDate, 'yyyyMMdd')}-${format(endDate, 'yyyyMMdd')}`;
      params.append('filename', filename);
      appendFilterParams(params, mergedFilters);

      await downloadExcel('/api/festival/sin-compra/export', params, filename);
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
          <EyeIcon className="h-4 w-4 text-gray-500" />
        </Button>
      </Tooltip>

      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="5xl" className="max-w-7xl">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                Clientes sin compra
                <span className="text-sm font-normal text-gray-500">
                  {reportTitle} · activos con compra en {startDate.getFullYear()} sin compra en el festival
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
                        startContent={<MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />}
                        value={search}
                        onValueChange={setSearch}
                        isClearable
                      />
                      <span className="text-sm text-gray-500 shrink-0">
                        {rows.length.toLocaleString('es-CO')} clientes
                      </span>
                    </div>
                    {rows.length === 0 ? (
                      <div className="text-sm text-gray-400 py-10 text-center">Sin resultados</div>
                    ) : (
                      // The table scrolls in its own container so the sticky
                      // header sits flush at the top — sticking to the padded
                      // ModalBody left a gap where rows showed through.
                      <div className="overflow-y-auto max-h-[65vh]">
                        <table className="w-full text-left">
                          <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_theme(colors.gray.200)]">
                            <tr className="text-xs font-semibold text-gray-600 tracking-wider">
                              <th className="py-2 pr-4">NIT</th>
                              <th className="py-2 pr-4">CLIENTE</th>
                              <th className="py-2">VENDEDOR</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.slice(0, MAX_VISIBLE_ROWS).map((r) => (
                              <tr key={r.customer_id} className="border-b border-gray-100 text-[13px]">
                                <td className="py-1.5 pr-4 font-mono text-gray-500">{r.customer_id}</td>
                                <td className="py-1.5 pr-4 font-medium text-zinc-900">{r.customer_name}</td>
                                <td className="py-1.5 text-gray-600">{r.seller_name}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {rows.length > MAX_VISIBLE_ROWS && (
                      <p className="text-xs text-gray-400">
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
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
