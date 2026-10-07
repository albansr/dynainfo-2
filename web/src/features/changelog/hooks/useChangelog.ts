import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/core/api/client';

export type ChangelogCategory = 'nuevo' | 'mejorado' | 'corregido';

/** A change: plain text, or text with its own small mockup. */
export type ChangelogItem = string | { text: string; image?: { src: string; alt: string } };

/** A published Novedades entry, as served by GET /api/changelog/entries (newest first). */
export interface ChangelogEntry {
  id: string;
  date: string;
  title: string;
  summary?: string;
  image?: { src: string; alt: string };
  changes: { category: ChangelogCategory; items: ChangelogItem[] }[];
}

/** Public Novedades entries. No session needed. */
export function useChangelogEntries() {
  return useQuery({
    queryKey: ['changelog', 'entries'],
    queryFn: async () =>
      (await apiClient<{ entries: ChangelogEntry[] }>('/api/changelog/entries')).entries,
  });
}

/**
 * Subscribe an email to the Novedades digest. `website` is the honeypot value:
 * always empty for real users.
 */
export function useSubscribeToChangelog() {
  return useMutation({
    mutationFn: (input: { email: string; website: string }) =>
      apiClient<{ ok: boolean }>('/api/changelog/subscribe', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}
