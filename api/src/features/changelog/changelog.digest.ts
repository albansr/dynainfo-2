/**
 * Daily Novedades digest — pure helpers to pick the entries that went live on a
 * day and render the email (subject, HTML and plain text). Sending lives in
 * changelog.digest.job.ts; these stay pure and unit-tested.
 */
import {
  CATEGORY_LABEL,
  itemText,
  publishedEntries,
  type ChangelogEntry,
  type ChangelogImage,
} from './changelog.entries.js';

export interface DigestLinks {
  /** Web app origin: base for the /novedades page and entry images. */
  webOrigin: string;
  /** Per-recipient one-click unsubscribe link. */
  unsubscribeUrl: string;
  /** Environment label for non-production sites ("DEV"); absent in production. */
  environmentTag?: string | null;
}

/** Published entries that went live on a given day (YYYY-MM-DD). */
export function entriesForDate(
  date: string,
  entries: readonly ChangelogEntry[] = publishedEntries(),
): ChangelogEntry[] {
  return entries.filter((entry) => entry.published && entry.date === date);
}

/** The calendar day before `date` (YYYY-MM-DD), DST/TZ-safe (UTC math). */
export function previousDay(date: string): string {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

/** The date (YYYY-MM-DD) and hour (0-23) of `now` in an IANA timezone. */
export function zonedDateHour(now: Date, timeZone: string): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    hour: Number(part('hour')),
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Render one level of `**bold**` to HTML, escaping everything else. */
function boldToHtml(text: string): string {
  return text
    .split('**')
    .map((part, i) => (i % 2 === 1 ? `<strong>${escapeHtml(part)}</strong>` : escapeHtml(part)))
    .join('');
}

/** Inline image block for the email (absolute URL: mail clients need one). */
function imageHtml(image: ChangelogImage, webOrigin: string, style: string): string {
  return `<img src="${escapeHtml(webOrigin + image.src)}" alt="${escapeHtml(image.alt)}" style="display:block;width:100%;height:auto;border:1px solid #e5e7eb;border-radius:8px;${style}">`;
}

/** Email subject for a day's digest, prefixed with the environment outside production. */
export function renderDigestSubject(
  entries: readonly ChangelogEntry[],
  environmentTag?: string | null,
): string {
  const [first] = entries;
  const subject =
    entries.length === 1 && first
      ? `Novedades DynaInfo · ${first.title}`
      : `Novedades DynaInfo · ${entries.length} novedades`;
  return environmentTag ? `[${environmentTag}] ${subject}` : subject;
}

function headerLabel(environmentTag?: string | null): string {
  return environmentTag ? `Novedades de DynaInfo · Entorno ${environmentTag}` : 'Novedades de DynaInfo';
}

/** Inline-styled HTML body (email clients ignore external CSS). */
export function renderDigestHtml(
  entries: readonly ChangelogEntry[],
  links: DigestLinks,
): string {
  const blocks = entries
    .map((entry) => {
      const image = entry.image ? imageHtml(entry.image, links.webOrigin, 'margin:0 0 12px;max-width:544px;') : '';
      const summary = entry.summary
        ? `<p style="margin:0 0 12px;color:#4b5563;line-height:1.5;">${escapeHtml(entry.summary)}</p>`
        : '';
      const groups = entry.changes
        .map((group) => {
          const items = group.items
            .map((item) => {
              const image = typeof item === 'string' ? undefined : item.image;
              return `<li style="margin:0 0 28px;color:#374151;line-height:1.5;">${boldToHtml(itemText(item))}${
                image ? imageHtml(image, links.webOrigin, 'margin:10px 0 0;max-width:420px;') : ''
              }</li>`;
            })
            .join('');
          return `<p style="margin:12px 0 4px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;">${escapeHtml(
            CATEGORY_LABEL[group.category],
          )}</p><ul style="margin:0 0 8px;padding-left:18px;">${items}</ul>`;
        })
        .join('');
      return `<div style="margin:0 0 24px;"><h2 style="margin:0 0 6px;font-size:18px;color:#1f2937;">${escapeHtml(
        entry.title,
      )}</h2>${summary}${image}${groups}</div>`;
    })
    .join('');

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:8px;">
  ${
    links.environmentTag
      ? `<p style="display:inline-block;font-size:12px;font-weight:600;color:#92400e;background:#fef3c7;border-radius:6px;padding:4px 10px;margin:0 0 16px;">${escapeHtml(headerLabel(links.environmentTag))}</p>`
      : `<p style="font-size:12px;color:#9ca3af;margin:0 0 16px;">${headerLabel()}</p>`
  }
  ${blocks}
  <div style="border-top:1px solid #e5e7eb;padding-top:16px;margin-top:8px;">
    <a href="${escapeHtml(`${links.webOrigin}/novedades`)}" style="display:inline-block;background:#333333;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px;">Ver todas las novedades</a>
  </div>
  <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">Recibes este correo porque te suscribiste a las novedades de DynaInfo. <a href="${escapeHtml(
    links.unsubscribeUrl,
  )}" style="color:#6b7280;">Darse de baja</a>.</p>
</div>`;
}

/** Plain-text part: multipart (text + HTML) is a deliverability and accessibility best practice. */
export function renderDigestText(
  entries: readonly ChangelogEntry[],
  links: DigestLinks,
): string {
  const blocks = entries.map((entry) => {
    const groups = entry.changes.map((group) =>
      [
        CATEGORY_LABEL[group.category].toUpperCase(),
        ...group.items.map((item) => `- ${itemText(item).replace(/\*\*/g, '')}`),
      ].join('\n'),
    );
    return [entry.title, entry.summary, ...groups].filter(Boolean).join('\n\n');
  });

  return [
    headerLabel(links.environmentTag),
    ...blocks,
    `Ver todas las novedades: ${links.webOrigin}/novedades`,
    `Recibes este correo porque te suscribiste a las novedades de DynaInfo. Darse de baja: ${links.unsubscribeUrl}`,
  ].join('\n\n');
}
