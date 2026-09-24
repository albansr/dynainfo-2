import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { appendFilterParams, downloadExcel } from './downloadExcel';
import { toast } from 'sonner';

describe('appendFilterParams', () => {
  it('appends single values', () => {
    const p = new URLSearchParams();
    appendFilterParams(p, { channel: 'DISTRIBUCION' });
    expect(p.toString()).toBe('channel=DISTRIBUCION');
  });

  it('serializes arrays as repeated params (IN filter)', () => {
    const p = new URLSearchParams();
    appendFilterParams(p, { IdRegional: ['0001', '0026'] });
    expect(p.getAll('IdRegional')).toEqual(['0001', '0026']);
  });

  it('skips undefined and null, keeps 0', () => {
    const p = new URLSearchParams();
    appendFilterParams(p, { a: undefined, b: null, c: 0 });
    expect(p.has('a')).toBe(false);
    expect(p.has('b')).toBe(false);
    expect(p.get('c')).toBe('0');
  });

  it('is a no-op when filters is undefined', () => {
    const p = new URLSearchParams();
    appendFilterParams(p, undefined);
    expect(p.toString()).toBe('');
  });

  it('preserves neq-style keys verbatim', () => {
    const p = new URLSearchParams();
    appendFilterParams(p, { 'ProveedorComercial[neq][]': ['VERA', 'FORTE'] });
    expect(p.getAll('ProveedorComercial[neq][]')).toEqual(['VERA', 'FORTE']);
  });
});

describe('downloadExcel', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });
  afterEach(() => vi.restoreAllMocks());

  it('downloads the blob and toasts success on 200', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['x'])),
    } as unknown as Response);

    await downloadExcel('/api/list/export', new URLSearchParams({ a: '1' }), 'file');

    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(toast.success).toHaveBeenCalledOnce();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('toasts the server error message on a failed response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: 'Demasiadas filas' }),
    } as unknown as Response);

    await downloadExcel('/api/list/export', new URLSearchParams(), 'file');

    expect(toast.error).toHaveBeenCalledWith('Demasiadas filas');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
