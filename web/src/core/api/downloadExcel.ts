import { toast } from 'sonner';
import { API_URL } from '@/core/config/constants';

/** A data filter value: a single value or several (serialized as repeated params). */
export type FilterValue = string | number | string[] | number[] | undefined | null;
/** A filter map applied to analytics requests. */
export type FilterMap = Record<string, FilterValue>;

/**
 * Append dynamic filters to URL params. Arrays become repeated params
 * (`k=a&k=b`); undefined/null are skipped. Single source of truth for how
 * filters are serialized across every data request and Excel export.
 */
export function appendFilterParams(params: URLSearchParams, filters?: FilterMap): void {
  if (!filters) return;
  for (const [key, value] of Object.entries(filters)) {
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, String(v)));
    } else if (value !== undefined && value !== null) {
      params.append(key, String(value));
    }
  }
}

/**
 * Download an Excel export: fetch the endpoint with credentials and trigger a
 * browser download. Toasts success/failure. Shared by every export button.
 */
export async function downloadExcel(path: string, params: URLSearchParams, filename: string): Promise<void> {
  try {
    const response = await fetch(`${API_URL}${path}?${params.toString()}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      let message = 'No se pudo generar el archivo Excel';
      try {
        const body = await response.json();
        if (body?.message) message = body.message;
      } catch {
        // non-JSON error body — keep default message
      }
      toast.error(message);
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Exportación completada');
  } catch {
    toast.error('No se pudo generar el archivo Excel');
  }
}
