import { describe, it, expect, vi, beforeEach } from 'vitest';

const captureScreenshot = vi.fn();
vi.mock('../utils/captureScreenshot', () => ({ captureScreenshot: () => captureScreenshot() }));

const { isDraftValid, wantsScreenshot, useSupportDrawerStore } = await import('./supportDrawerStore');
type Draft = Parameters<typeof isDraftValid>[0];

const draft = (patch: Partial<Draft> = {}): Draft => ({
  type: 'data',
  subject: '',
  description: 'En proveedores no aparece',
  includeScreenshot: null,
  ...patch,
});

describe('ticket draft', () => {
  it('is valid with a type and a description of 10+ characters (the subject is optional)', () => {
    expect(isDraftValid(draft())).toBe(true);
    expect(isDraftValid(draft({ type: null }))).toBe(false);
    expect(isDraftValid(draft({ description: ' corta ' }))).toBe(false);
  });

  it('follows the type default for the screenshot until the user chooses', () => {
    expect(wantsScreenshot(draft())).toBe(true);
    expect(wantsScreenshot(draft({ type: 'suggestion' }))).toBe(false);
    expect(wantsScreenshot(draft({ type: 'suggestion', includeScreenshot: true }))).toBe(true);
    expect(wantsScreenshot(draft({ includeScreenshot: false }))).toBe(false);
  });
});

describe('useSupportDrawerStore', () => {
  beforeEach(() => {
    useSupportDrawerStore.setState({ isOpen: false });
    useSupportDrawerStore.getState().reset();
    captureScreenshot.mockReset();
  });

  it('opens pre-filled and captures the screen behind the drawer', async () => {
    captureScreenshot.mockResolvedValue('BASE64');

    useSupportDrawerStore.getState().open({ type: 'data', subject: 'Cumpl. presupuesto: no cuadra' });

    expect(useSupportDrawerStore.getState()).toMatchObject({
      isOpen: true,
      draft: { type: 'data', subject: 'Cumpl. presupuesto: no cuadra' },
      screenshot: { status: 'capturing' },
    });
    await vi.waitFor(() => expect(useSupportDrawerStore.getState().screenshot).toEqual({ status: 'ready', base64: 'BASE64' }));
  });

  it('records a failed capture, ignores a second open and resets after sending', async () => {
    captureScreenshot.mockResolvedValue(null);
    const store = useSupportDrawerStore.getState();

    store.open();
    store.open();
    await vi.waitFor(() => expect(useSupportDrawerStore.getState().screenshot).toEqual({ status: 'failed' }));
    expect(captureScreenshot).toHaveBeenCalledTimes(1);

    store.updateDraft({ description: 'algo' });
    store.close();
    expect(useSupportDrawerStore.getState()).toMatchObject({ isOpen: false, draft: { description: 'algo' } });

    store.reset();
    expect(useSupportDrawerStore.getState().draft.description).toBe('');
    expect(useSupportDrawerStore.getState().screenshot).toEqual({ status: 'idle' });
  });
});
