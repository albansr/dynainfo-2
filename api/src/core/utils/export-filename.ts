import type { FastifyReply } from 'fastify';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Strip characters unsafe for a Content-Disposition filename. */
export function sanitizeFilename(name: string | undefined): string {
  if (!name) return '';
  // eslint-disable-next-line no-control-regex
  return name.replace(/[\x00-\x1f/\\:*?"<>|]+/g, '').trim().slice(0, 120);
}

/**
 * Send an xlsx buffer as a download named `requestedName` (sanitized), or
 * `fallbackName` when absent: an ASCII filename plus the UTF-8 one (RFC 6266),
 * so accented names survive in every browser.
 */
export function sendXlsx(
  reply: FastifyReply,
  buffer: Buffer,
  requestedName: string | undefined,
  fallbackName: string
): FastifyReply {
  const baseName = sanitizeFilename(requestedName) || fallbackName;
  const asciiName = baseName.replace(/[^\x20-\x7e]+/g, '_');
  const encodedName = encodeURIComponent(`${baseName}.xlsx`);
  return reply
    .header('Content-Type', XLSX_MIME)
    .header('Content-Disposition', `attachment; filename="${asciiName}.xlsx"; filename*=UTF-8''${encodedName}`)
    .send(buffer);
}
