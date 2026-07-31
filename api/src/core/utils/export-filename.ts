/** Strip characters unsafe for a Content-Disposition filename. */
export function sanitizeFilename(name: string | undefined): string {
  if (!name) return '';
  // eslint-disable-next-line no-control-regex
  return name.replace(/[\x00-\x1f/\\:*?"<>|]+/g, '').trim().slice(0, 120);
}
