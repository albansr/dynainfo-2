import { describe, it, expect } from 'vitest';
import { ticketProgress } from './ticketProgress';

const NOW = new Date('2026-10-15T12:00:00Z');
const base = { status: 'open' as const, awaitingTeam: true, satisfied: null, resolvedAt: null, lastActivityAt: '2026-10-13T12:00:00Z' };

describe('ticketProgress', () => {
  it('tells the requester what to expect at each stage', () => {
    expect(ticketProgress(base, 'requester', NOW)).toEqual({
      step: 0,
      message: 'La hemos recibido. Normalmente respondemos en 1 día hábil.',
      teamTurn: true,
    });
    expect(ticketProgress({ ...base, awaitingTeam: false }, 'requester', NOW)).toMatchObject({
      step: 1,
      message: 'Te hemos respondido. Contesta abajo cuando puedas.',
    });
    expect(ticketProgress({ ...base, status: 'in_progress' }, 'requester', NOW)).toMatchObject({
      step: 1,
      message: 'Estamos trabajando en ello.',
    });
  });

  it('gives the closing date of a resolved request', () => {
    const resolved = { ...base, status: 'resolved' as const, awaitingTeam: false, resolvedAt: '2026-10-15T15:00:00Z' };
    expect(ticketProgress(resolved, 'requester', NOW)).toEqual({
      step: 2,
      message: 'Resuelta el 15 de octubre. Si no nos dices nada, se cerrará el 22 de octubre.',
      teamTurn: false,
    });
    expect(ticketProgress(resolved, 'agent', NOW).message).toContain('Si el usuario no dice nada');
  });

  it('closed requests mention the confirmation', () => {
    const closed = { ...base, status: 'closed' as const, satisfied: true };
    expect(ticketProgress(closed, 'requester', NOW).message).toBe('Cerrada. Gracias por confirmarnos que se solucionó.');
    expect(ticketProgress(closed, 'agent', NOW).message).toBe('Cerrada. El usuario confirmó que se solucionó.');
    expect(ticketProgress({ ...closed, satisfied: null }, 'agent', NOW)).toMatchObject({ step: 3, message: 'Cerrada.' });
  });

  it('tells agents whose turn it is and how long it has waited', () => {
    expect(ticketProgress(base, 'agent', NOW)).toEqual({ step: 0, message: 'Le toca al equipo desde anteayer.', teamTurn: true });
    expect(ticketProgress({ ...base, lastActivityAt: '2026-10-15T09:00:00Z' }, 'agent', NOW).message).toBe(
      'Le toca al equipo desde hace 3 horas.',
    );
    expect(ticketProgress({ ...base, lastActivityAt: NOW.toISOString() }, 'agent', NOW).message).toBe('Le toca al equipo.');
    expect(ticketProgress({ ...base, awaitingTeam: false }, 'agent', NOW)).toMatchObject({
      message: 'Esperando la respuesta del usuario.',
      teamTurn: false,
    });
  });
});
