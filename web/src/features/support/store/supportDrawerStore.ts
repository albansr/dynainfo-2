import { create } from 'zustand';
import { DESCRIPTION_MIN, screenshotByDefault, type TicketType } from '../config/support';
import { captureScreenshot } from '../utils/captureScreenshot';

/** The new-request form, kept while the drawer is closed (and if sending fails). */
export interface TicketDraft {
  type: TicketType | null;
  /** Optional: the first line of the description is used when left empty. */
  subject: string;
  description: string;
  /** null = follow the type's default (screenshotByDefault); a boolean once the user chose. */
  includeScreenshot: boolean | null;
}

/** The screen as it was when the drawer opened (so it shows what the user was looking at). */
export type ScreenshotState =
  | { status: 'idle' }
  | { status: 'capturing' }
  | { status: 'ready'; base64: string }
  | { status: 'failed' };

const EMPTY_DRAFT: TicketDraft = { type: null, subject: '', description: '', includeScreenshot: null };

/** Whether the screenshot will be sent for this draft. */
export function wantsScreenshot(draft: TicketDraft): boolean {
  return draft.includeScreenshot ?? screenshotByDefault(draft.type);
}

/** A type chosen and a description long enough (the API re-validates). */
export function isDraftValid(draft: TicketDraft): draft is TicketDraft & { type: TicketType } {
  return draft.type !== null && draft.description.trim().length >= DESCRIPTION_MIN;
}

interface SupportDrawerStore {
  isOpen: boolean;
  draft: TicketDraft;
  screenshot: ScreenshotState;
  /** Open the drawer (optionally pre-filling the form) and capture the screen behind it. */
  open: (prefill?: Partial<TicketDraft>) => void;
  close: () => void;
  updateDraft: (patch: Partial<TicketDraft>) => void;
  /** Forget the form and the screenshot (after sending). */
  reset: () => void;
}

/** "Ayuda y soporte" drawer: opened from the sidebar, /soporte, closed requests and "¿Este dato no cuadra?". */
export const useSupportDrawerStore = create<SupportDrawerStore>()((set, get) => ({
  isOpen: false,
  draft: EMPTY_DRAFT,
  screenshot: { status: 'idle' },
  open: (prefill) => {
    if (get().isOpen) return;
    set((state) => ({
      isOpen: true,
      draft: prefill ? { ...state.draft, ...prefill } : state.draft,
      screenshot: { status: 'capturing' },
    }));
    // The drawer is left out of the capture, so it can open right away
    void captureScreenshot().then((base64) =>
      set({ screenshot: base64 ? { status: 'ready', base64 } : { status: 'failed' } }),
    );
  },
  close: () => set({ isOpen: false }),
  updateDraft: (patch) => set((state) => ({ draft: { ...state.draft, ...patch } })),
  reset: () => set({ draft: EMPTY_DRAFT, screenshot: { status: 'idle' } }),
}));
