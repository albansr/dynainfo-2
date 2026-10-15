import { describe, it, expect } from 'vitest';
import {
  renderAgentReplyEmail,
  renderNewTicketEmail,
  renderRequesterReplyEmail,
  renderResolvedEmail,
  type EmailTicket,
} from '../../../src/features/support/support.emails.js';

const ticket: EmailTicket = {
  number: 12,
  type: 'data',
  subject: 'No sale el presupuesto',
  description: 'En proveedores <script>alert(1)</script>\nsegunda línea',
  path: '/distribucion/detalle',
  requester: { name: 'Ana Pérez', email: 'ana@dyna.co' },
};
const links = { ticketUrl: 'https://dynainfo.com.co/soporte/12', environmentTag: null };

describe('support emails', () => {
  it('new ticket: number, type, subject, requester, screen and link; HTML escaped', () => {
    const email = renderNewTicketEmail(ticket, links);

    expect(email.subject).toBe('Nueva solicitud #12 · Dato incorrecto · No sale el presupuesto');
    expect(email.html).toContain('Ana Pérez &lt;ana@dyna.co&gt;');
    expect(email.html).toContain('/distribucion/detalle');
    expect(email.html).toContain('&lt;script&gt;');
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('segunda línea');
    expect(email.html).toContain('href="https://dynainfo.com.co/soporte/12"');
    expect(email.text).toContain('Ver solicitud: https://dynainfo.com.co/soporte/12');
  });

  it('prefixes the environment outside production', () => {
    const email = renderNewTicketEmail(ticket, { ...links, environmentTag: 'DEV' });

    expect(email.subject.startsWith('[DEV] Nueva solicitud #12')).toBe(true);
  });

  it('requester reply goes to the team with the reply quoted', () => {
    const email = renderRequesterReplyEmail(ticket, 'Sigue pasando', links);

    expect(email.subject).toBe('Respuesta en la solicitud #12 · No sale el presupuesto');
    expect(email.text).toContain('Sigue pasando');
  });

  it('agent reply invites the requester to answer', () => {
    const email = renderAgentReplyEmail(ticket, '¿Qué fechas tenías?', links);

    expect(email.subject).toBe('Te respondimos en la solicitud #12');
    expect(email.html).toContain('Ver y responder');
    expect(email.text).toContain('¿Qué fechas tenías?');
  });

  it('resolved links the Novedades entry only when there is one', () => {
    const entry = { title: 'Presupuesto en el detalle', url: 'https://dynainfo.com.co/novedades#x' };
    const withEntry = renderResolvedEmail(ticket, 'Ya está', entry, links);
    const without = renderResolvedEmail(ticket, null, null, links);

    expect(withEntry.subject).toBe('Tu solicitud #12 está resuelta');
    expect(withEntry.html).toContain('href="https://dynainfo.com.co/novedades#x"');
    expect(withEntry.text).toContain('Lo arreglamos: Presupuesto en el detalle');
    expect(withEntry.text).toContain('Ya está');
    expect(without.html).not.toContain('Lo arreglamos');
    expect(without.text).toContain('antes de 7 días');
  });
});
