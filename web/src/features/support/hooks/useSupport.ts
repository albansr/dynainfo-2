import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiBlob, apiClient } from '@/core/api/client';
import type { StatusFilter, TicketPriority, TicketStatus, TicketType } from '../config/support';

/** What the requester was looking at (mirror of the API's SupportContext). */
export interface SupportContext {
  path: string;
  search: string;
  pageTitle: string;
  dateRange: { start: string; end: string; preset: string | number | null };
  dynaRole: string | null;
  scope: string | null;
  realDynaRole?: string | null;
  /** Human-readable description (page name, filters by label), built when sending. */
  summary?: { page: string; items: { label: string; value: string }[] };
  userAgent: string;
  viewport: { width: number; height: number };
}

export interface Person {
  name: string | null;
  email: string;
}

export interface TicketSummary {
  number: number;
  type: TicketType;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  /** Whose turn it is: true = the team has to answer. */
  awaitingTeam: boolean;
  lastActivityAt: string;
  createdAt: string;
  requester?: Person;
}

export interface TicketMessage {
  id: string;
  body: string;
  internal: boolean;
  authorIsAgent: boolean;
  authorName: string | null;
  createdAt: string;
}

export interface TicketDetail {
  number: number;
  type: TicketType;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  changelogEntryId: string | null;
  awaitingTeam: boolean;
  /** The requester's answer to "¿Se solucionó?" (null = not answered). */
  satisfied: boolean | null;
  lastActivityAt: string;
  resolvedAt: string | null;
  createdAt: string;
  hasScreenshot: boolean;
  requester: Person;
  /** Full for agents; only path, search and dateRange for the requester. */
  context: Partial<SupportContext>;
  messages: TicketMessage[];
  /** Agents only: the requester's other requests and others from the same screen. */
  related?: RelatedTicket[];
}

export interface RelatedTicket {
  number: number;
  subject: string;
  status: TicketStatus;
  sameRequester: boolean;
  lastActivityAt: string;
}

export interface TicketListParams {
  scope: 'mine' | 'all';
  status: StatusFilter;
  type: TicketType | null;
  priority: TicketPriority | null;
  page: number;
}

export interface NewTicket {
  type: TicketType;
  subject: string;
  description: string;
  context: SupportContext;
  screenshot?: string;
}

export const TICKETS_PAGE_SIZE = 20;

/** Query string for the list endpoint (omits "all" status and empty filters). */
export function ticketListQuery({ scope, status, type, priority, page }: TicketListParams): string {
  const params = new URLSearchParams({ scope, page: String(page), limit: String(TICKETS_PAGE_SIZE) });
  if (status !== 'all') params.set('status', status);
  if (type) params.set('type', type);
  if (priority) params.set('priority', priority);
  return params.toString();
}

export function useSupportTickets(params: TicketListParams) {
  return useQuery({
    queryKey: ['support', 'tickets', params],
    queryFn: () =>
      apiClient<{ data: TicketSummary[]; total: number; page: number; limit: number }>(
        `/api/support/tickets?${ticketListQuery(params)}`,
      ),
  });
}

export function useSupportTicket(number: number | null) {
  return useQuery({
    queryKey: ['support', 'ticket', number],
    queryFn: () => apiClient<TicketDetail>(`/api/support/tickets/${number}`),
    enabled: number !== null,
    // A different ticket must not show the previous one while it loads
    placeholderData: undefined,
  });
}

export function useSupportScreenshot(number: number, enabled: boolean) {
  return useQuery({
    queryKey: ['support', 'screenshot', number],
    queryFn: () => apiBlob(`/api/support/tickets/${number}/screenshot`),
    enabled,
    staleTime: Infinity,
  });
}

/** Active requests, and how many wait for the team (the agents' badge). */
export function useSupportSummary(enabled: boolean) {
  return useQuery({
    queryKey: ['support', 'summary'],
    queryFn: () => apiClient<{ open: number; awaitingTeam: number }>('/api/support/summary'),
    enabled,
    refetchInterval: 60_000,
  });
}

/** The user's own active requests, and how many wait for their answer (the team replied). */
export function useMySupportSummary(enabled: boolean) {
  return useQuery({
    queryKey: ['support', 'summary', 'mine'],
    queryFn: () => apiClient<{ active: number; awaitingMe: number }>('/api/support/summary/mine'),
    enabled,
    refetchInterval: 60_000,
  });
}

/** Mutations invalidate every support query (list, detail, badge). */
function useInvalidateSupport() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['support'] });
}

export function useCreateTicket() {
  const invalidate = useInvalidateSupport();
  return useMutation({
    mutationFn: (ticket: NewTicket) =>
      apiClient<{ number: number }>('/api/support/tickets', { method: 'POST', body: JSON.stringify(ticket) }),
    onSuccess: invalidate,
  });
}

export function useAddMessage(number: number) {
  const invalidate = useInvalidateSupport();
  return useMutation({
    mutationFn: (input: { body: string; internal: boolean; resolve?: boolean }) =>
      apiClient<TicketMessage>(`/api/support/tickets/${number}/messages`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  });
}

export interface TicketPatch {
  status?: TicketStatus;
  priority?: TicketPriority;
  changelogEntryId?: string | null;
}

export function useUpdateTicket(number: number) {
  const invalidate = useInvalidateSupport();
  return useMutation({
    mutationFn: (patch: TicketPatch) =>
      apiClient<TicketDetail>(`/api/support/tickets/${number}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: invalidate,
  });
}

/** The requester answers "¿Se solucionó?": solved closes the request, not solved reopens it. */
export function useTicketFeedback(number: number) {
  const invalidate = useInvalidateSupport();
  return useMutation({
    mutationFn: (input: { solved: boolean; body?: string }) =>
      apiClient<TicketDetail>(`/api/support/tickets/${number}/feedback`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  });
}
