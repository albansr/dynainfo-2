const DEV_WEB_ORIGIN = 'http://localhost:4000';

/** Web origins from ORIGIN_URL (comma-separated: production + preview), without trailing slashes. */
function configuredWebOrigins(): string[] {
  return (process.env['ORIGIN_URL'] ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

/** Every origin the web app may be served from, plus the local Vite dev server. */
export function webOrigins(): string[] {
  return [...configuredWebOrigins(), DEV_WEB_ORIGIN];
}

/** Normalize an origin-like string and return it only if it is one of our web origins. */
export function matchWebOrigin(candidate: string | null | undefined): string | null {
  if (!candidate) return null;
  const normalized = candidate.trim().replace(/\/$/, '');
  return webOrigins().includes(normalized) ? normalized : null;
}

/** A stored/requested origin if it is still one of ours, otherwise the primary web origin. */
export function resolveWebOrigin(candidate: string | null | undefined): string {
  return matchWebOrigin(candidate) ?? primaryWebOrigin();
}

/**
 * Short environment label for a web origin, or null for the primary (production)
 * one: derived from the first host label ("dev.dynainfo.com.co" → "DEV",
 * "localhost" → "LOCAL").
 */
export function environmentTag(origin: string): string | null {
  if (origin === primaryWebOrigin() && origin !== DEV_WEB_ORIGIN) return null;
  const { hostname } = new URL(origin);
  if (hostname === 'localhost') return 'LOCAL';
  const [label] = hostname.split('.');
  return (label ?? '').toUpperCase() || null;
}

/**
 * The single web origin to send users back to: the first (production) ORIGIN_URL
 * in production, the local dev server otherwise.
 */
export function primaryWebOrigin(): string {
  const [primary] = configuredWebOrigins();
  return process.env['NODE_ENV'] === 'production' && primary ? primary : DEV_WEB_ORIGIN;
}
