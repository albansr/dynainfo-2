import { describe, it, expect } from 'vitest';
import { dataReportDraft } from './dataReport';

describe('dataReportDraft', () => {
  it('pre-fills a "Dato incorrecto" request with the figure', () => {
    expect(dataReportDraft('CUMPL. PRESUPUESTO', '85,74%')).toEqual({
      type: 'data',
      subject: 'CUMPL. PRESUPUESTO: el dato no cuadra',
      description: 'En «CUMPL. PRESUPUESTO» veo 85,74% y esperaba ',
    });
    expect(dataReportDraft('Tabla por Proveedor').description).toBe('En «Tabla por Proveedor» ');
  });
});
