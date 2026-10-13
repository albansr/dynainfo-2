import { describe, it, expect } from 'vitest';
import { adaptFiltersForTable } from '../../../src/core/config/table-filters.config.js';
import type { FilterCondition } from '../../../src/core/db/clickhouse/query/filter-builder.js';

describe('adaptFiltersForTable', () => {
  const channel: FilterCondition = { field: 'channel', operator: 'eq', value: 'CADENAS' };
  const regional: FilterCondition = { field: 'IdRegional', operator: 'in', value: ['0002', '0019'] };

  it('leaves tables with a channel column untouched', () => {
    expect(adaptFiltersForTable([channel, regional], 'transactions')).toEqual([channel, regional]);
  });

  it('narrows cartera to a channel through its regionals and trims IdRegional', () => {
    expect(adaptFiltersForTable([channel, regional], 'cartera')).toEqual([
      { field: 'IdRegional', operator: 'in', value: ['0010'], trim: true },
      { ...regional, trim: true },
    ]);
  });

  it('expands several channels and excludes a channel with one condition per regional', () => {
    expect(adaptFiltersForTable([{ field: 'channel', operator: 'in', value: ['EXPORTACIONES', 'CADENAS'] }], 'cartera'))
      .toEqual([{ field: 'IdRegional', operator: 'in', value: ['0016', '0010'], trim: true }]);
    expect(adaptFiltersForTable([{ field: 'channel', operator: 'neq', value: 'CADENAS' }], 'cartera'))
      .toEqual([{ field: 'IdRegional', operator: 'neq', value: '0010', trim: true }]);
  });

  it('matches nothing for an unknown channel instead of the whole company', () => {
    expect(adaptFiltersForTable([{ field: 'channel', operator: 'eq', value: 'OTRO' }], 'cartera'))
      .toEqual([{ field: 'IdRegional', operator: 'in', value: ['__none__'], trim: true }]);
  });
});
