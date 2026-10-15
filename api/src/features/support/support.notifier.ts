/**
 * Support email notifications through the shared Resend client. A failed send
 * is logged and never fails the request that triggered it.
 */
import { resend, EMAIL_FROM } from '../../core/email/resend.client.js';
import { environmentTag, resolveWebOrigin } from '../../core/config/web-origin.js';
import { logger } from '../../core/logger/logger.js';
import {
  renderAgentReplyEmail,
  renderNewTicketEmail,
  renderRequesterReplyEmail,
  renderResolvedEmail,
  type EmailLinks,
  type EmailTicket,
  type RenderedEmail,
} from './support.emails.js';

/** A ticket as the emails need it, plus the site it came from. */
export interface TicketMail extends EmailTicket {
  webOrigin: string;
}

/** Support team addresses from SUPPORT_NOTIFY_EMAILS (comma-separated). */
export function supportNotifyEmails(): string[] {
  return (process.env['SUPPORT_NOTIFY_EMAILS'] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function linksFor(ticket: TicketMail): EmailLinks & { webOrigin: string } {
  // Back to the site the request came from (dev or prod), re-checked against ORIGIN_URL
  const webOrigin = resolveWebOrigin(ticket.webOrigin);
  return {
    webOrigin,
    ticketUrl: `${webOrigin}/soporte/${ticket.number}`,
    environmentTag: environmentTag(webOrigin),
  };
}

export class SupportNotifier {
  async newTicket(ticket: TicketMail): Promise<void> {
    await this.send(supportNotifyEmails(), renderNewTicketEmail(ticket, linksFor(ticket)), ticket.number);
  }

  async requesterReply(ticket: TicketMail, reply: string): Promise<void> {
    await this.send(supportNotifyEmails(), renderRequesterReplyEmail(ticket, reply, linksFor(ticket)), ticket.number);
  }

  async agentReply(ticket: TicketMail, reply: string): Promise<void> {
    await this.send([ticket.requester.email], renderAgentReplyEmail(ticket, reply, linksFor(ticket)), ticket.number);
  }

  async resolved(
    ticket: TicketMail,
    lastReply: string | null,
    entry: { id: string; title: string } | null,
  ): Promise<void> {
    const links = linksFor(ticket);
    const linked = entry ? { title: entry.title, url: `${links.webOrigin}/novedades#${entry.id}` } : null;
    await this.send([ticket.requester.email], renderResolvedEmail(ticket, lastReply, linked, links), ticket.number);
  }

  private async send(to: string[], email: RenderedEmail, number: number): Promise<void> {
    if (to.length === 0) return;
    try {
      const { error } = await resend.emails.send({ from: EMAIL_FROM, to, ...email });
      if (error) {
        logger.error({ type: 'support_email_error', err: error, ticket: number }, 'Failed to send support email');
      }
    } catch (err) {
      logger.error({ type: 'support_email_error', err, ticket: number }, 'Failed to send support email');
    }
  }
}
