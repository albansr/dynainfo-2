/**
 * Support emails — pure renderers (subject, HTML, plain text). Sending lives in
 * support.notifier.ts; these stay pure and unit-tested.
 */
import { escapeHtml } from '../../core/utils/html.js';
import type { TicketType } from './support.schemas.js';

/** Spanish label of each request type (mirrors the web config). */
export const TICKET_TYPE_LABEL: Record<TicketType, string> = {
  error: 'Error en la app',
  data: 'Dato incorrecto',
  access: 'Acceso o permisos',
  suggestion: 'Sugerencia',
};

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** The screen the request came from, as the web described it (page name, filters by label). */
export interface ContextSummary {
  page: string;
  items: { label: string; value: string }[];
}

export interface EmailTicket {
  number: number;
  type: TicketType;
  subject: string;
  description: string;
  path: string;
  summary: ContextSummary | null;
  hasScreenshot: boolean;
  requester: { name: string | null; email: string };
}

export interface EmailLinks {
  /** Link to the request in the web app (/soporte/:number). */
  ticketUrl: string;
  /** Environment label for non-production sites ("DEV"); null in production. */
  environmentTag: string | null;
}

const LONG_DATE = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', timeZone: 'America/Bogota' });

/** "22 de octubre" (project timezone). */
export function formatLongDate(date: Date): string {
  return LONG_DATE.format(date);
}

function withTag(subject: string, tag: string | null): string {
  return tag ? `[${tag}] ${subject}` : subject;
}

function requesterLabel(requester: EmailTicket['requester']): string {
  return requester.name ? `${requester.name} <${requester.email}>` : requester.email;
}

/** Plain text as HTML paragraphs (escaped, line breaks kept). */
function paragraphs(text: string): string {
  return escapeHtml(text).replace(/\n/g, '<br>');
}

interface Button {
  label: string;
  url: string;
  secondary?: boolean;
}

function buttonHtml({ label, url, secondary }: Button): string {
  const style = secondary
    ? 'background:#ffffff;color:#18181b;border:1px solid #d4d4d8'
    : 'background:#18181b;color:#ffffff;border:1px solid #18181b';
  return `<a href="${escapeHtml(url)}" style="display:inline-block;${style};text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px;margin:0 8px 8px 0">${escapeHtml(label)}</a>`;
}

function layout(title: string, body: string, buttons: Button[], footer: string): string {
  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;padding:24px">
<h1 style="font-size:18px;margin:0 0 16px">${escapeHtml(title)}</h1>
${body}
<p style="margin:24px 0 0">${buttons.map(buttonHtml).join('')}</p>
<p style="margin:16px 0 0;font-size:12px;color:#71717a">${escapeHtml(footer)}</p>
</div></body></html>`;
}

function quote(text: string, label?: string): string {
  const heading = label ? `<div style="font-size:12px;color:#71717a;margin-bottom:4px">${escapeHtml(label)}</div>` : '';
  return `<div style="border-left:3px solid #e4e4e7;padding:4px 0 4px 12px;margin:12px 0;font-size:14px;line-height:1.5">${heading}${paragraphs(text)}</div>`;
}

/** Context rows for the team: screen, filters, dates and role as the web described them. */
function contextRows(ticket: EmailTicket): { label: string; value: string }[] {
  const rows = [{ label: 'Pantalla', value: ticket.summary?.page ?? (ticket.path || '/') }];
  rows.push(...(ticket.summary?.items ?? []));
  rows.push({ label: 'Captura', value: ticket.hasScreenshot ? 'Sí, en la solicitud' : 'No' });
  return rows;
}

function contextTable(rows: { label: string; value: string }[]): string {
  const cells = rows
    .map(
      (r) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#71717a;vertical-align:top;white-space:nowrap">${escapeHtml(r.label)}</td><td style="padding:4px 0">${escapeHtml(r.value)}</td></tr>`,
    )
    .join('');
  return `<table style="font-size:13px;border-collapse:collapse;margin:12px 0">${cells}</table>`;
}

const teamFooter = 'DynaInfo · Soporte. Recibes este correo porque atiendes las solicitudes de soporte.';
const requesterFooter = (number: number) =>
  `DynaInfo · Soporte. Recibes este correo porque enviaste la solicitud #${number}.`;

/** To the support team: a new request, with what's needed to triage it without opening the app. */
export function renderNewTicketEmail(ticket: EmailTicket, links: EmailLinks): RenderedEmail {
  const type = TICKET_TYPE_LABEL[ticket.type];
  const title = `Nueva solicitud #${ticket.number} · ${type}`;
  const subject = withTag(`${title} · ${ticket.subject}`, links.environmentTag);
  const rows = contextRows(ticket);
  const html = layout(
    title,
    `<p style="font-size:14px;margin:0 0 4px"><strong>${escapeHtml(ticket.subject)}</strong></p>
<p style="font-size:13px;color:#52525b;margin:0">De ${escapeHtml(requesterLabel(ticket.requester))}</p>
${quote(ticket.description)}
${contextTable(rows)}`,
    [{ label: 'Responder', url: `${links.ticketUrl}#responder` }],
    teamFooter,
  );
  const text = [
    title,
    ticket.subject,
    `De ${requesterLabel(ticket.requester)}`,
    '',
    ticket.description,
    '',
    ...rows.map((r) => `${r.label}: ${r.value}`),
    '',
    `Responder: ${links.ticketUrl}#responder`,
    '',
    teamFooter,
  ].join('\n');
  return { subject, html, text };
}

/** To the support team: the requester replied, or said the problem goes on. */
export function renderRequesterReplyEmail(
  ticket: EmailTicket,
  reply: string | null,
  reopened: boolean,
  links: EmailLinks,
): RenderedEmail {
  const title = reopened
    ? `La solicitud #${ticket.number} sigue sin resolverse`
    : `Respuesta en la solicitud #${ticket.number}`;
  const subject = withTag(`${title} · ${ticket.subject}`, links.environmentTag);
  const who = requesterLabel(ticket.requester);
  const lead = reopened ? `${who} dice que sigue pasando.` : `${who} escribió:`;
  const html = layout(
    title,
    `<p style="font-size:13px;color:#52525b;margin:0">${escapeHtml(lead)}</p>${reply ? quote(reply) : ''}`,
    [{ label: 'Responder', url: `${links.ticketUrl}#responder` }],
    teamFooter,
  );
  const text = [title, lead, ...(reply ? ['', reply] : []), '', `Responder: ${links.ticketUrl}#responder`, '', teamFooter].join('\n');
  return { subject, html, text };
}

/** To the requester: the team replied (with what they had asked, for context). */
export function renderAgentReplyEmail(
  ticket: EmailTicket,
  reply: string,
  requesterWords: string,
  links: EmailLinks,
): RenderedEmail {
  const title = `Te respondimos en la solicitud #${ticket.number}`;
  const subject = withTag(title, links.environmentTag);
  const html = layout(
    title,
    `<p style="font-size:13px;color:#52525b;margin:0">Sobre «${escapeHtml(ticket.subject)}»:</p>
${quote(reply, 'Equipo DynaInfo')}
${quote(requesterWords, 'Tu mensaje')}`,
    [{ label: 'Ver y responder', url: `${links.ticketUrl}#responder` }],
    requesterFooter(ticket.number),
  );
  const text = [
    title,
    `Sobre «${ticket.subject}»:`,
    '',
    `Equipo DynaInfo: ${reply}`,
    '',
    `Tu mensaje: ${requesterWords}`,
    '',
    `Ver y responder: ${links.ticketUrl}#responder`,
    '',
    requesterFooter(ticket.number),
  ].join('\n');
  return { subject, html, text };
}

/**
 * To the requester: resolved, with the Novedades entry that solved it (if any)
 * and one-click answers to "¿Se solucionó?" that close or reopen it.
 */
export function renderResolvedEmail(
  ticket: EmailTicket,
  lastReply: string | null,
  entry: { title: string; url: string } | null,
  closesOn: Date,
  links: EmailLinks,
): RenderedEmail {
  const title = `Tu solicitud #${ticket.number} está resuelta`;
  const subject = withTag(title, links.environmentTag);
  const deadline = `Si no nos dices nada, la cerraremos el ${formatLongDate(closesOn)}.`;
  const solvedUrl = `${links.ticketUrl}?feedback=solved`;
  const notSolvedUrl = `${links.ticketUrl}?feedback=not_solved`;
  const html = layout(
    title,
    `<p style="font-size:13px;color:#52525b;margin:0">Sobre «${escapeHtml(ticket.subject)}».</p>
${lastReply ? quote(lastReply, 'Equipo DynaInfo') : ''}
${entry ? `<p style="font-size:14px;margin:12px 0">Lo arreglamos: <a href="${escapeHtml(entry.url)}" style="color:#2563eb">${escapeHtml(entry.title)}</a></p>` : ''}
<p style="font-size:14px;margin:16px 0 0"><strong>¿Se solucionó?</strong></p>
<p style="font-size:13px;color:#52525b;margin:4px 0 0">${escapeHtml(deadline)}</p>`,
    [
      { label: 'Sí, todo bien', url: solvedUrl },
      { label: 'Sigue pasando', url: notSolvedUrl, secondary: true },
    ],
    requesterFooter(ticket.number),
  );
  const text = [
    title,
    `Sobre «${ticket.subject}».`,
    ...(lastReply ? ['', `Equipo DynaInfo: ${lastReply}`] : []),
    ...(entry ? ['', `Lo arreglamos: ${entry.title} (${entry.url})`] : []),
    '',
    '¿Se solucionó?',
    `Sí, todo bien: ${solvedUrl}`,
    `Sigue pasando: ${notSolvedUrl}`,
    deadline,
    '',
    requesterFooter(ticket.number),
  ].join('\n');
  return { subject, html, text };
}
