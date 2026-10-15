/** `:number` from the URL as a positive integer, or null (invalid → not found, never a cast). */
export function parseTicketNumber(raw: string | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  const number = Number(raw);
  return number >= 1 ? number : null;
}
