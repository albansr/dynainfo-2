import { describe, it, expect } from 'vitest';
import {
  activeCustomerFilters,
  coversCustomerMaster,
  masterUniverseFilters,
} from '../../../src/core/config/customer-master.config.js';

describe('customer master', () => {
  describe('coversCustomerMaster', () => {
    it('covers Compañía General, Distribución, its regionals and the brand boards', () => {
      expect(coversCustomerMaster([])).toBe(true);
      expect(coversCustomerMaster([{ field: 'channel', operator: 'eq', value: 'DISTRIBUCION' }])).toBe(true);
      expect(coversCustomerMaster([{ field: 'IdRegional', operator: 'in', value: ['0001', '0019'] }])).toBe(true);
      expect(coversCustomerMaster([{ field: 'ProveedorComercial', operator: 'in', value: ['VERA', 'FORTE'] }])).toBe(true);
    });

    it('does not cover other channels or non-commercial regionals', () => {
      expect(coversCustomerMaster([{ field: 'channel', operator: 'eq', value: 'EXPORTACIONES' }])).toBe(false);
      expect(coversCustomerMaster([{ field: 'channel', operator: 'in', value: ['EXPORTACIONES', 'CADENAS'] }])).toBe(false);
      expect(coversCustomerMaster([{ field: 'IdRegional', operator: 'eq', value: 'RTL' }])).toBe(false);
    });
  });

  describe('masterUniverseFilters', () => {
    it('keeps only the dimensions the master carries, scoped to it', () => {
      expect(masterUniverseFilters([
        { field: 'channel', operator: 'eq', value: 'DISTRIBUCION' },
        { field: 'seller_id', operator: 'eq', value: 'CL01' },
        { field: 'date', operator: 'gte', value: '2026-10-01' },
        { field: 'IdRegional', operator: 'eq', value: '0002', table: 'pedidos_retenidos', trim: true },
      ])).toEqual([
        ...activeCustomerFilters(),
        { field: 'seller_id', operator: 'eq', value: 'CL01', table: 'clientes' },
      ]);
    });
  });
});
