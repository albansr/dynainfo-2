import { describe, it, expect } from 'vitest';
import { isDraftValid, wantsScreenshot, type TicketDraft } from './supportDrawerStore';

const draft = (patch: Partial<TicketDraft> = {}): TicketDraft => ({
  type: 'data',
  subject: 'No sale el presupuesto',
  description: 'En proveedores no aparece',
  includeScreenshot: null,
  ...patch,
});

describe('ticket draft', () => {
  it('is valid with a type, a subject of 3+ and a description of 10+ characters', () => {
    expect(isDraftValid(draft())).toBe(true);
    expect(isDraftValid(draft({ type: null }))).toBe(false);
    expect(isDraftValid(draft({ subject: '  ab  ' }))).toBe(false);
    expect(isDraftValid(draft({ description: 'corta' }))).toBe(false);
  });

  it('follows the type default for the screenshot until the user chooses', () => {
    expect(wantsScreenshot(draft())).toBe(true);
    expect(wantsScreenshot(draft({ type: 'suggestion' }))).toBe(false);
    expect(wantsScreenshot(draft({ type: 'suggestion', includeScreenshot: true }))).toBe(true);
    expect(wantsScreenshot(draft({ includeScreenshot: false }))).toBe(false);
  });
});

describe('useSupportDrawerStore', () => {
  it('opens, closes and keeps the draft until reset', async () => {
    const { useSupportDrawerStore } = await import('./supportDrawerStore');
    const store = useSupportDrawerStore.getState();

    store.open();
    store.updateDraft({ type: 'error', subject: 'No carga' });
    store.close();

    expect(useSupportDrawerStore.getState()).toMatchObject({ isOpen: false, draft: { type: 'error', subject: 'No carga' } });

    store.resetDraft();
    expect(useSupportDrawerStore.getState().draft).toEqual({ type: null, subject: '', description: '', includeScreenshot: null });
  });
});
