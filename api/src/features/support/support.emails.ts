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

export interface EmailTicket {
  number: number;
  type: TicketType;
  subject: string;
  description: string;
  path: string;
  requester: { name: string | null; email: string };
}

export interface EmailLinks {
  /** Link to the request in the web app (/soporte/:number). */
  ticketUrl: string;
  /** Environment label for non-production sites ("DEV"); null in production. */
  environmentTag: string | null;
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

function layout(title: string, body: string, button: { label: string; url: string }): string {
  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;padding:24px">
<h1 style="font-size:18px;margin:0 0 16px">${escapeHtml(title)}</h1>
${body}
<p style="margin:24px 0 0"><a href="${escapeHtml(button.url)}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px">${escapeHtml(button.label)}</a></p>
<p style="margin:24px 0 0;font-size:12px;color:#71717a">DynaInfo · Soporte</p>
</div></body></html>`;
}

function quote(text: string): string {
  return `<div style="border-left:3px solid #e4e4e7;padding:4px 0 4px 12px;margin:12px 0;font-size:14px;line-height:1.5">${paragraphs(text)}</div>`;
}

/** To the support team: a new request. */
export function renderNewTicketEmail(ticket: EmailTicket, links: EmailLinks): RenderedEmail {
  const type = TICKET_TYPE_LABEL[ticket.type];
  const title = `Nueva solicitud #${ticket.number} · ${type}`;
  const subject = withTag(`${title} · ${ticket.subject}`, links.environmentTag);
  const html = layout(
    title,
    `<p style="font-size:14px;margin:0 0 4px"><strong>${escapeHtml(ticket.subject)}</strong></p>
<p style="font-size:13px;color:#52525b;margin:0">De ${escapeHtml(requesterLabel(ticket.requester))} · Pantalla ${escapeHtml(ticket.path || '/')}</p>
${quote(ticket.description)}`,
    { label: 'Ver solicitud', url: links.ticketUrl },
  );
  const text = [
    title,
    ticket.subject,
    `De ${requesterLabel(ticket.requester)} · Pantalla ${ticket.path || '/'}`,
    '',
    ticket.description,
    '',
    `Ver solicitud: ${links.ticketUrl}`,
  ].join('\n');
  return { subject, html, text };
}

/** To the support team: the requester replied. */
export function renderRequesterReplyEmail(ticket: EmailTicket, reply: string, links: EmailLinks): RenderedEmail {
  const title = `Respuesta en la solicitud #${ticket.number}`;
  const subject = withTag(`${title} · ${ticket.subject}`, links.environmentTag);
  const html = layout(
    title,
    `<p style="font-size:13px;color:#52525b;margin:0">${escapeHtml(requesterLabel(ticket.requester))} escribió:</p>${quote(reply)}`,
    { label: 'Ver solicitud', url: links.ticketUrl },
  );
  const text = [title, `${requesterLabel(ticket.requester)} escribió:`, '', reply, '', `Ver solicitud: ${links.ticketUrl}`].join('\n');
  return { subject, html, text };
}

/** To the requester: the team replied. */
export function renderAgentReplyEmail(ticket: EmailTicket, reply: string, links: EmailLinks): RenderedEmail {
  const title = `Te respondimos en la solicitud #${ticket.number}`;
  const subject = withTag(title, links.environmentTag);
  const html = layout(
    title,
    `<p style="font-size:13px;color:#52525b;margin:0">Sobre «${escapeHtml(ticket.subject)}»:</p>${quote(reply)}`,
    { label: 'Ver y responder', url: links.ticketUrl },
  );
  const text = [title, `Sobre «${ticket.subject}»:`, '', reply, '', `Ver y responder: ${links.ticketUrl}`].join('\n');
  return { subject, html, text };
}

/** To the requester: the request is resolved (with the Novedades entry that solved it, if any). */
export function renderResolvedEmail(
  ticket: EmailTicket,
  lastReply: string | null,
  entry: { title: string; url: string } | null,
  links: EmailLinks,
): RenderedEmail {
  const title = `Tu solicitud #${ticket.number} está resuelta`;
  const subject = withTag(title, links.environmentTag);
  const reopenHint = 'Si sigue pasando, responde en la solicitud antes de 7 días y la reabrimos.';
  const html = layout(
    title,
    `<p style="font-size:13px;color:#52525b;margin:0">Sobre «${escapeHtml(ticket.subject)}».</p>
${lastReply ? quote(lastReply) : ''}
${entry ? `<p style="font-size:14px;margin:12px 0">Lo arreglamos: <a href="${escapeHtml(entry.url)}" style="color:#2563eb">${escapeHtml(entry.title)}</a></p>` : ''}
<p style="font-size:13px;color:#52525b;margin:12px 0 0">${reopenHint}</p>`,
    { label: 'Ver solicitud', url: links.ticketUrl },
  );
  const text = [
    title,
    `Sobre «${ticket.subject}».`,
    ...(lastReply ? ['', lastReply] : []),
    ...(entry ? ['', `Lo arreglamos: ${entry.title} (${entry.url})`] : []),
    '',
    reopenHint,
    `Ver solicitud: ${links.ticketUrl}`,
  ].join('\n');
  return { subject, html, text };
}
