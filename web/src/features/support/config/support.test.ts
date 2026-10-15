import { describe, it, expect } from 'vitest';
import {
  STATUS_FILTER_LABEL,
  TICKET_PRIORITIES,
  TICKET_PRIORITY,
  TICKET_STATUS,
  TICKET_STATUSES,
  TICKET_TYPE,
  TICKET_TYPES,
  screenshotByDefault,
  ticketSubject,
} from './support';

describe('support config', () => {
  it('has a Spanish label for every type, status and priority', () => {
    for (const t of TICKET_TYPES) expect(TICKET_TYPE[t].label).toBeTruthy();
    for (const s of TICKET_STATUSES) expect(TICKET_STATUS[s].label).toBeTruthy();
    for (const p of TICKET_PRIORITIES) expect(TICKET_PRIORITY[p].label).toBeTruthy();
    expect(STATUS_FILTER_LABEL).toMatchObject({ active: 'Abiertas y en curso', all: 'Todas', open: 'Abierta', closed: 'Cerrada' });
  });

  it('suggests the screenshot for errors and wrong data only', () => {
    expect(screenshotByDefault('error')).toBe(true);
    expect(screenshotByDefault('data')).toBe(true);
    expect(screenshotByDefault('access')).toBe(false);
    expect(screenshotByDefault('suggestion')).toBe(false);
    expect(screenshotByDefault(null)).toBe(false);
  });
});

describe('ticketSubject', () => {
  it('keeps a written subject, otherwise uses the first line of the description', () => {
    expect(ticketSubject('  No carga Estado ', 'x')).toBe('No carga Estado');
    expect(ticketSubject('', 'El presupuesto sale en 0\nen proveedores')).toBe('El presupuesto sale en 0');
    expect(ticketSubject('ab', 'Sin asunto suficiente')).toBe('Sin asunto suficiente');
    const long = 'a'.repeat(120);
    expect(ticketSubject('', long)).toHaveLength(80);
    expect(ticketSubject('', long).endsWith('…')).toBe(true);
  });
});
