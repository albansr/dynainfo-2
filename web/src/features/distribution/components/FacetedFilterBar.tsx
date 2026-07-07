import { useEffect, useMemo, useState } from 'react';
import {
  Popover, PopoverTrigger, PopoverContent, Button, Checkbox, Input, Spinner,
} from '@heroui/react';
import { PlusIcon, XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useDimensionValues, type DimensionValue } from '@/core/api/hooks/useDimensionValues';
import type { GroupByDimension } from '@/core/api/hooks/useList';
import { DIM_CATEGORIES, DIM_LABEL } from '../config/breakdownDimensions';

/** Applied filters: dimension → selected values (id + name). */
export type AppliedFilters = Record<string, DimensionValue[]>;

interface ValuePickerProps {
  dimension: GroupByDimension;
  contextFilters?: Record<string, any>;
  initialSelected: DimensionValue[];
  onApply: (values: DimensionValue[]) => void;
}

/** Searchable multi-select value picker for one dimension. */
function ValuePicker({ dimension, contextFilters, initialSelected, onApply }: ValuePickerProps) {
  const [selected, setSelected] = useState<Map<string, string>>(
    () => new Map(initialSelected.map((v) => [v.id, v.name]))
  );
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(input.trim()), 250);
    return () => clearTimeout(t);
  }, [input]);

  const { values, isLoading } = useDimensionValues(dimension, contextFilters, search);

  const toggle = (v: DimensionValue, on: boolean) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (on) next.set(v.id, v.name);
      else next.delete(v.id);
      return next;
    });
  };

  // Pin selected values that aren't in the current results so they stay visible/uncheckable.
  const resultIds = new Set(values.map((v) => v.id));
  const pinned = Array.from(selected.entries())
    .filter(([id]) => !resultIds.has(id))
    .map(([id, name]) => ({ id, name }));

  const rows = [...pinned, ...values];

  return (
    <div className="w-72 p-1">
      <Input
        autoFocus
        size="sm"
        placeholder="Escribe para buscar…"
        value={input}
        onValueChange={setInput}
        isClearable
        onClear={() => setInput('')}
        startContent={<MagnifyingGlassIcon className="h-4 w-4 text-default-400" />}
        className="mb-2"
      />
      <div className="max-h-64 overflow-y-auto pr-1">
        {isLoading && rows.length === 0 ? (
          <div className="flex justify-center py-6"><Spinner size="sm" /></div>
        ) : rows.length === 0 ? (
          <div className="text-center text-xs text-default-400 py-6">Sin resultados</div>
        ) : (
          rows.map((v) => (
            <label
              key={v.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-default-100"
            >
              <Checkbox
                size="sm"
                isSelected={selected.has(v.id)}
                onValueChange={(on) => toggle(v, on)}
              />
              <span className="text-sm truncate">{v.name}</span>
            </label>
          ))
        )}
      </div>
      <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-default-100">
        <Button size="sm" variant="light" onPress={() => setSelected(new Map())}>Limpiar</Button>
        <Button
          size="sm"
          color="primary"
          onPress={() => onApply(Array.from(selected, ([id, name]) => ({ id, name })))}
        >
          Aplicar
        </Button>
      </div>
    </div>
  );
}

interface FacetedProps {
  value: AppliedFilters;
  onChange: (value: AppliedFilters) => void;
  contextFilters?: Record<string, any>;
}

function setFilterValue(
  value: AppliedFilters,
  onChange: (v: AppliedFilters) => void,
  dim: string,
  values: DimensionValue[]
) {
  const next = { ...value };
  if (values.length) next[dim] = values;
  else delete next[dim];
  onChange(next);
}

/**
 * Applied-filter chips (each editable via a popover, removable via X) + Clear.
 * Renders nothing when there are no applied filters.
 */
/** Chip label: field + the selected value names (truncated if many). */
function chipSummary(dim: string, values: DimensionValue[]): string {
  const label = DIM_LABEL[dim] ?? dim;
  const names = values.map((v) => v.name);
  const shown = names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} +${names.length - 3}`;
  return `${label}: ${shown}`;
}

export function FacetedFilterChips({ value, onChange, contextFilters }: FacetedProps) {
  const appliedDims = Object.keys(value).filter((k) => value[k]?.length);
  if (appliedDims.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {appliedDims.map((dim) => (
        <div
          key={dim}
          className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs pl-2.5 pr-1 py-0.5"
        >
          <Popover placement="bottom-start">
            <PopoverTrigger>
              <button className="font-medium max-w-[22rem] truncate" title={chipSummary(dim, value[dim]!)}>
                {chipSummary(dim, value[dim]!)}
              </button>
            </PopoverTrigger>
            <PopoverContent>
              <ValuePicker
                dimension={dim as GroupByDimension}
                contextFilters={contextFilters}
                initialSelected={value[dim]!}
                onApply={(vals) => setFilterValue(value, onChange, dim, vals)}
              />
            </PopoverContent>
          </Popover>
          <button
            aria-label="Quitar filtro"
            className="hover:bg-primary/20 rounded-full p-0.5"
            onClick={() => setFilterValue(value, onChange, dim, [])}
          >
            <XMarkIcon className="h-3 w-3" />
          </button>
        </div>
      ))}
      <Button size="sm" variant="light" onPress={() => onChange({})}>Limpiar</Button>
    </div>
  );
}

/**
 * "Add filter" popover button: pick a field → searchable multi-select of its
 * values. Designed to sit next to the export button.
 */
export function FacetedFilterAddButton({ value, onChange, contextFilters }: FacetedProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [addingDim, setAddingDim] = useState<GroupByDimension | null>(null);

  const appliedDims = Object.keys(value).filter((k) => value[k]?.length);
  const availableCategories = useMemo(
    () =>
      DIM_CATEGORIES
        .map((c) => ({ ...c, dims: c.dims.filter((d) => !appliedDims.includes(d.key)) }))
        .filter((c) => c.dims.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appliedDims.join(',')]
  );

  return (
    <Popover
      placement="bottom-end"
      isOpen={addOpen}
      onOpenChange={(open) => {
        setAddOpen(open);
        if (!open) setAddingDim(null);
      }}
    >
      <PopoverTrigger>
        <Button size="sm" variant="flat" startContent={<PlusIcon className="h-4 w-4" />}>
          Añadir filtro
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        {addingDim ? (
          <ValuePicker
            dimension={addingDim}
            contextFilters={contextFilters}
            initialSelected={value[addingDim] ?? []}
            onApply={(vals) => {
              setFilterValue(value, onChange, addingDim, vals);
              setAddOpen(false);
              setAddingDim(null);
            }}
          />
        ) : (
          <div className="w-56 max-h-72 overflow-y-auto py-1">
            {availableCategories.map((cat) => (
              <div key={cat.id} className="mb-1">
                <div className="px-2 py-1 text-[10px] font-semibold uppercase text-default-400">{cat.label}</div>
                {cat.dims.map((d) => (
                  <button
                    key={d.key}
                    className="w-full text-left text-sm px-2 py-1.5 rounded-md hover:bg-default-100"
                    onClick={() => setAddingDim(d.key)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            ))}
            {availableCategories.length === 0 && (
              <div className="text-center text-xs text-default-400 py-4">Todos los filtros añadidos</div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
