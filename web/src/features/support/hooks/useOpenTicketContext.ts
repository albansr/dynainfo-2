import { useNavigate } from 'react-router-dom';
import { useDateRangeStore } from '@/core/store/dateRangeStore';
import { useViewAsStore } from '@/core/store/viewAsStore';
import type { SupportContext } from './useSupport';
import { contextUrl, dateRangeRestore } from '../utils/supportContext';

/**
 * Reopen the screen a request was sent from: apply its date range, optionally
 * view it as the requester's role ("Ver como su rol", agents only), then
 * navigate to the same URL (page + filters).
 */
export function useOpenTicketContext() {
  const navigate = useNavigate();
  const { setPreset, setCustomRange } = useDateRangeStore.getState();
  const startViewAs = useViewAsStore((s) => s.start);

  return (context: Partial<SupportContext>, viewAs?: { ticketNumber: number }) => {
    const range = dateRangeRestore(context.dateRange);
    if (range?.kind === 'preset') setPreset(range.preset);
    if (range?.kind === 'custom') setCustomRange(range.start, range.end);
    if (viewAs) {
      startViewAs({ dynaRole: context.dynaRole ?? null, scope: context.scope ?? null, ticketNumber: viewAs.ticketNumber });
    }
    navigate(contextUrl(context));
  };
}
