import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockSend = vi.fn();
vi.mock('../../../src/core/email/resend.client.js', () => ({
  resend: { emails: { send: (...args: unknown[]) => mockSend(...args) } },
  EMAIL_FROM: 'DynaInfo <no-reply@test>',
}));
vi.mock('../../../src/core/logger/logger.js', () => ({ logger: { error: vi.fn(), info: vi.fn() } }));

const { SupportNotifier, supportNotifyEmails } = await import('../../../src/features/support/support.notifier.js');

const ticket = {
  number: 12,
  type: 'data' as const,
  subject: 'No sale el presupuesto',
  description: 'En proveedores',
  path: '/distribucion/detalle',
  webOrigin: 'https://dev.dynainfo.com.co',
  requester: { name: 'Ana', email: 'ana@dyna.co' },
};

describe('SupportNotifier', () => {
  beforeEach(() => {
    mockSend.mockReset().mockResolvedValue({ error: null });
    vi.stubEnv('ORIGIN_URL', 'https://dynainfo.com.co,https://dev.dynainfo.com.co');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SUPPORT_NOTIFY_EMAILS', ' soporte@dyna.co , ');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('parses SUPPORT_NOTIFY_EMAILS', () => {
    expect(supportNotifyEmails()).toEqual(['soporte@dyna.co']);
  });

  it('emails the team about a new ticket, linking back to the site it came from', async () => {
    await new SupportNotifier().newTicket(ticket);

    const [mail] = mockSend.mock.calls[0] as [Record<string, string>];
    expect(mail).toMatchObject({ from: 'DynaInfo <no-reply@test>', to: ['soporte@dyna.co'] });
    expect(mail['subject']).toMatch(/^\[DEV\] Nueva solicitud #12/);
    expect(mail['text']).toContain('https://dev.dynainfo.com.co/soporte/12');
  });

  it('emails the requester on agent replies and on resolution with the Novedades link', async () => {
    const notifier = new SupportNotifier();
    await notifier.agentReply(ticket, 'Revisado');
    await notifier.resolved(ticket, null, { id: 'entry-1', title: 'Arreglo' });

    expect(mockSend.mock.calls.map(([m]) => (m as { to: string[] }).to)).toEqual([['ana@dyna.co'], ['ana@dyna.co']]);
    expect((mockSend.mock.calls[1]?.[0] as { text: string }).text).toContain('https://dev.dynainfo.com.co/novedades#entry-1');
  });

  it('sends nothing without recipients and never throws on provider errors', async () => {
    vi.stubEnv('SUPPORT_NOTIFY_EMAILS', '');
    await new SupportNotifier().requesterReply(ticket, 'hola');
    expect(mockSend).not.toHaveBeenCalled();

    mockSend.mockResolvedValueOnce({ error: { message: 'bad' } }).mockRejectedValueOnce(new Error('down'));
    await expect(new SupportNotifier().agentReply(ticket, 'x')).resolves.toBeUndefined();
    await expect(new SupportNotifier().agentReply(ticket, 'x')).resolves.toBeUndefined();
  });
});
