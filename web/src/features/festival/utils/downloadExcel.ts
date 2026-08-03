import { toast } from 'sonner';
import { API_URL } from '@/core/config/constants';

/**
 * Download a festival Excel export: fetch the endpoint with credentials and
 * trigger a browser download. Toasts success/failure.
 */
export async function downloadExcel(path: string, params: URLSearchParams, filename: string): Promise<void> {
  try {
    const response = await fetch(`${API_URL}${path}?${params.toString()}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      toast.error('No se pudo generar el archivo Excel');
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

/** Append dynamic filters to export params (arrays become repeated params). */
export function appendFilterParams(params: URLSearchParams, filters?: Record<string, unknown>): void {
  if (!filters) return;
  for (const [key, value] of Object.entries(filters)) {
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, String(v)));
    } else if (value !== undefined && value !== null) {
      params.append(key, String(value));
    }
  }
}
