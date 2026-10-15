import { describe, it, expect } from 'vitest';
import {
  formatLongDate,
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
  summary: {
    page: 'Detalle · Marcas Exclusivas',
    items: [
      { label: 'Agrupado por', value: 'Proveedor' },
      { label: 'Fechas', value: 'Acumulado · 01/01/2026 - 30/09/2026' },
      { label: 'Rol', value: 'Vendedor · CL07' },
    ],
  },
  hasScreenshot: true,
  requester: { name: 'Ana Pérez', email: 'ana@dyna.co' },
};
const links = { ticketUrl: 'https://dynainfo.com.co/soporte/12', environmentTag: null };

describe('support emails', () => {
  it('new ticket: subject, requester, escaped description and the context to triage', () => {
    const email = renderNewTicketEmail(ticket, links);

    expect(email.subject).toBe('Nueva solicitud #12 · Dato incorrecto · No sale el presupuesto');
    expect(email.html).toContain('Ana Pérez &lt;ana@dyna.co&gt;');
    expect(email.html).toContain('&lt;script&gt;');
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('Detalle · Marcas Exclusivas');
    expect(email.text).toContain('Agrupado por: Proveedor');
    expect(email.text).toContain('Rol: Vendedor · CL07');
    expect(email.text).toContain('Captura: Sí, en la solicitud');
    expect(email.html).toContain('href="https://dynainfo.com.co/soporte/12#responder"');
    expect(email.text).toContain('atiendes las solicitudes de soporte');
  });

  it('falls back to the raw path without a summary, and prefixes the environment', () => {
    const email = renderNewTicketEmail({ ...ticket, summary: null, hasScreenshot: false }, { ...links, environmentTag: 'DEV' });

    expect(email.subject.startsWith('[DEV] Nueva solicitud #12')).toBe(true);
    expect(email.text).toContain('Pantalla: /distribucion/detalle');
    expect(email.text).toContain('Captura: No');
  });

  it('requester reply, and "sigue pasando" with or without a comment', () => {
    const reply = renderRequesterReplyEmail(ticket, 'Sigue igual', false, links);
    const reopened = renderRequesterReplyEmail(ticket, null, true, links);

    expect(reply.subject).toBe('Respuesta en la solicitud #12 · No sale el presupuesto');
    expect(reply.text).toContain('Sigue igual');
    expect(reopened.subject).toBe('La solicitud #12 sigue sin resolverse · No sale el presupuesto');
    expect(reopened.text).toContain('dice que sigue pasando');
  });

  it('agent reply quotes what the requester had said', () => {
    const email = renderAgentReplyEmail(ticket, '¿Qué fechas tenías?', 'No sale el presupuesto en proveedores', links);

    expect(email.subject).toBe('Te respondimos en la solicitud #12');
    expect(email.text).toContain('Equipo DynaInfo: ¿Qué fechas tenías?');
    expect(email.text).toContain('Tu mensaje: No sale el presupuesto en proveedores');
    expect(email.html).toContain('#responder');
    expect(email.text).toContain('porque enviaste la solicitud #12');
  });

  it('resolved: one-click answers, a concrete closing date and the entry only when linked', () => {
    const closesOn = new Date('2026-10-22T15:00:00Z');
    const entry = { title: 'Presupuesto en el detalle', url: 'https://dynainfo.com.co/novedades#x' };
    const withEntry = renderResolvedEmail(ticket, 'Ya está', entry, closesOn, links);
    const without = renderResolvedEmail(ticket, null, null, closesOn, links);

    expect(withEntry.subject).toBe('Tu solicitud #12 está resuelta');
    expect(withEntry.html).toContain('href="https://dynainfo.com.co/soporte/12?feedback=solved"');
    expect(withEntry.html).toContain('href="https://dynainfo.com.co/soporte/12?feedback=not_solved"');
    expect(withEntry.text).toContain('la cerraremos el 22 de octubre');
    expect(withEntry.text).toContain('Lo arreglamos: Presupuesto en el detalle');
    expect(without.html).not.toContain('Lo arreglamos');
  });

  it('formats long dates in Spanish (Bogota)', () => {
    expect(formatLongDate(new Date('2026-10-22T03:00:00Z'))).toBe('21 de octubre');
  });
});
