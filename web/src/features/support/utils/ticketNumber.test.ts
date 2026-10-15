import { describe, it, expect } from 'vitest';
import { parseTicketNumber } from './ticketNumber';

describe('parseTicketNumber', () => {
  it('accepts positive integers only', () => {
    expect(parseTicketNumber('12')).toBe(12);
    for (const raw of [undefined, '', '0', '-3', '1.5', 'abc', '12abc']) expect(parseTicketNumber(raw)).toBeNull();
  });
});
