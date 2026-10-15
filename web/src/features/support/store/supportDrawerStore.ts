import { create } from 'zustand';
import {
  DESCRIPTION_MIN,
  SUBJECT_MIN,
  screenshotByDefault,
  type TicketType,
} from '../config/support';

/** The new-request form, kept while the drawer is closed (and if sending fails). */
export interface TicketDraft {
  type: TicketType | null;
  subject: string;
  description: string;
  /** null = follow the type's default (screenshotByDefault); a boolean once the user chose. */
  includeScreenshot: boolean | null;
}

const EMPTY_DRAFT: TicketDraft = { type: null, subject: '', description: '', includeScreenshot: null };

/** Whether the screenshot will be sent for this draft. */
export function wantsScreenshot(draft: TicketDraft): boolean {
  return draft.includeScreenshot ?? screenshotByDefault(draft.type);
}

/** Type chosen, subject and description long enough (the API re-validates). */
export function isDraftValid(draft: TicketDraft): draft is TicketDraft & { type: TicketType } {
  return (
    draft.type !== null &&
    draft.subject.trim().length >= SUBJECT_MIN &&
    draft.description.trim().length >= DESCRIPTION_MIN
  );
}

interface SupportDrawerStore {
  isOpen: boolean;
  draft: TicketDraft;
  open: () => void;
  close: () => void;
  updateDraft: (patch: Partial<TicketDraft>) => void;
  resetDraft: () => void;
}

/** "Ayuda y soporte" drawer: opened from the sidebar, /soporte and closed requests. */
export const useSupportDrawerStore = create<SupportDrawerStore>()((set) => ({
  isOpen: false,
  draft: EMPTY_DRAFT,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  updateDraft: (patch) => set((state) => ({ draft: { ...state.draft, ...patch } })),
  resetDraft: () => set({ draft: EMPTY_DRAFT }),
}));
