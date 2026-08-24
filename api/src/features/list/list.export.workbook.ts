import ExcelJS from 'exceljs';
import type { ExportRow } from './list.export.transform.js';
import {
  toArgb,
  variationColor,
  complianceColor,
  marginCurrentColor,
  marginVariationColor,
  marginBudgetColor,
} from './list.export.heatmap.js';

export interface BuildWorkbookInput {
  rows: ExportRow[];
  totals: ExportRow;
  hideBudgetColumns: boolean;
  hideRetainedColumn: boolean;
  /** Lead with CÓDIGO ITEM (IdItem) + REFERENCIA (product_id) — product listings only. */
  showProductCode?: boolean;
  dimensionLabel: string;
  billingLabel: string;
  totalsLabel: string;
  currentYear: number;
  previousYear: number;
  /** Report title shown at the top (e.g. the page title). */
  reportTitle?: string;
  /** Human-readable reporting period (concrete dates, e.g. "1 de enero – 30 de junio de 2026"). */
  periodLabel?: string;
  /** Date the export was generated (shown next to the period). */
  generatedLabel?: string;
}

type ColFormat = 'text' | 'currency' | 'percent' | 'pp';

interface ExcelColumn {
  id: string;
  header: string;
  group: 'billing' | 'margin' | null;
  format: ColFormat;
  width: number;
  value: (row: ExportRow) => number | string | null;
  color?: (row: ExportRow) => string; // hex6, no '#'
}

const NUM_FMT: Record<ColFormat, string | undefined> = {
  text: undefined,
  currency: '"$"#,##0',
  percent: '#,##0.00"%"',
  pp: '+#,##0.00"pp";-#,##0.00"pp"',
};

// Palette (ARGB). Dark slate header, zebra body, emphasized total — matches the app tone.
const FONT = 'Calibri';
const HEADER_FILL = 'FF1E293B'; // label row (slate-800)
const GROUP_HEADER_FILL = 'FF334155'; // group row (slate-700)
const HEADER_TEXT = 'FFFFFFFF';
const BODY_TEXT = 'FF334155';
const MUTED_TEXT = 'FF64748B'; // slate-500 (note/subtitle)
const ZEBRA_FILL = 'FFF8FAFC'; // slate-50
const TOTAL_FILL = 'FFE2E8F0'; // slate-200
const TOTAL_BORDER = 'FF94A3B8'; // slate-400
const BORDER = 'FFE2E8F0';
const GROUP_MARGIN_LABEL = 'MARGEN VS PRESUPUESTO';

/**
 * Build the ordered Excel column list for the given variant.
 * Every multi-value on-screen cell is split into its own column.
 */
function buildColumns(input: BuildWorkbookInput): ExcelColumn[] {
  const { hideBudgetColumns, hideRetainedColumn, showProductCode, dimensionLabel, currentYear, previousYear } = input;
  const finite = (v: number): number | null => (Number.isFinite(v) ? v : null);

  // Product listings lead with the item code (IdItem) and reference (product_id),
  // blank on the TOTAL row (identified by the 'totals' sentinel id).
  const productCodeCols: ExcelColumn[] = showProductCode
    ? [
        {
          id: 'itemCode', header: 'CÓDIGO ITEM', group: null, format: 'text', width: 16,
          value: (r) => (r.id === 'totals' ? null : (r.code ?? r.id)),
        },
        {
          id: 'reference', header: 'REFERENCIA', group: null, format: 'text', width: 16,
          value: (r) => (r.id === 'totals' ? null : r.id),
        },
      ]
    : [];

  const cols: ExcelColumn[] = [
    ...productCodeCols,
    {
      id: 'dimension', header: dimensionLabel, group: null, format: 'text', width: 30,
      value: (r) => r.name,
    },
    {
      id: 'salesCurrent', header: `Ventas ${currentYear}`, group: 'billing', format: 'currency', width: 16,
      value: (r) => r.sales.current,
    },
    {
      id: 'salesVariation', header: `% Var. vs ${previousYear}`, group: 'billing', format: 'percent', width: 14,
      value: (r) => finite(r.sales.variation), color: (r) => variationColor(r.sales.variation),
    },
    {
      id: 'salesPrevious', header: `Ventas ${previousYear}`, group: 'billing', format: 'currency', width: 16,
      value: (r) => r.sales.previous,
    },
    {
      id: 'budgetAmount', header: 'Presupuesto', group: 'billing', format: 'currency', width: 16,
      value: (r) => (r.budget.amount === 0 ? null : r.budget.amount),
    },
    {
      id: 'budgetCompliance', header: '% Cumpl. Presupuesto', group: 'billing', format: 'percent', width: 16,
      value: (r) => (r.budget.amount === 0 ? null : r.budget.compliance),
      color: (r) => complianceColor(r.budget.compliance),
    },
    {
      id: 'marginCurrent', header: 'Margen Real %', group: 'margin', format: 'percent', width: 14,
      value: (r) => r.margin.current, color: (r) => marginCurrentColor(r.margin.variation),
    },
    {
      id: 'marginVariation', header: `% Var. Margen vs ${previousYear}`, group: 'margin', format: 'percent', width: 16,
      value: (r) => finite(r.margin.variation), color: (r) => marginVariationColor(r.margin.variation),
    },
    {
      id: 'marginPrevious', header: `Margen ${previousYear} %`, group: 'margin', format: 'percent', width: 14,
      value: (r) => finite(r.margin.previous),
    },
    {
      id: 'marginBudget', header: 'Margen Presupuesto %', group: 'margin', format: 'percent', width: 16,
      value: (r) => (r.margin.budget === 0 ? null : r.margin.budget),
      color: (r) => marginBudgetColor(r.margin.budget - r.margin.current),
    },
    {
      id: 'marginDelta', header: 'Delta Margen (pp)', group: 'margin', format: 'pp', width: 15,
      value: (r) => (r.margin.budget === 0 ? null : r.margin.budget - r.margin.current),
      color: (r) => marginBudgetColor(r.margin.budget - r.margin.current),
    },
    {
      id: 'retainedAmount', header: 'Retenido en Cartera', group: null, format: 'currency', width: 16,
      value: (r) => (r.retained.amount === 0 ? null : r.retained.amount),
    },
    {
      id: 'retainedCompliance', header: '% Cumpl. Cartera', group: null, format: 'percent', width: 14,
      value: (r) => (r.retained.amount === 0 ? null : r.retained.compliance),
      color: (r) => complianceColor(r.retained.compliance),
    },
  ];

  const budgetIds = new Set(['budgetAmount', 'budgetCompliance', 'marginBudget', 'marginDelta']);
  const retainedIds = new Set(['retainedAmount', 'retainedCompliance']);

  return cols.filter((c) => {
    if (hideBudgetColumns && budgetIds.has(c.id)) return false;
    if (hideRetainedColumn && retainedIds.has(c.id)) return false;
    return true;
  });
}

export async function buildListExportWorkbook(input: BuildWorkbookInput): Promise<Buffer> {
  const columns = buildColumns(input);
  const lastCol = columns.length;
  // Groups (2-row header) only exist when budget columns are shown.
  const hasGroups = !input.hideBudgetColumns;
  const headerRows = hasGroups ? 2 : 1;

  // Optional report title block above the table (title, period, comparison note, spacer).
  const hasTitle = Boolean(input.reportTitle || input.periodLabel);
  const topOffset = hasTitle ? 4 : 0;
  const headerTop = topOffset + 1; // first header row
  const labelRow = topOffset + headerRows; // row index of the individual column labels

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Export', {
    views: [{ state: 'frozen', xSplit: 1, ySplit: labelRow }],
  });

  // Column-level width + default numFmt/alignment. Applying style at the column
  // level (instead of per-cell) is dramatically faster for large exports.
  ws.columns = columns.map((c) => {
    const fmt = NUM_FMT[c.format];
    // Column-level default style (numFmt + alignment + body font). Applying these
    // once per column instead of per cell is the key perf win for large exports.
    const style: Partial<ExcelJS.Style> = {
      alignment: { horizontal: c.format === 'text' ? 'left' : 'right' },
      font: { name: FONT, color: { argb: BODY_TEXT } },
    };
    if (fmt) style.numFmt = fmt;
    return { width: c.width, style };
  });

  // ---- Report title block ----
  if (hasTitle) {
    const titleRow = ws.getRow(1);
    ws.mergeCells(1, 1, 1, lastCol);
    titleRow.getCell(1).value = input.reportTitle || 'Informe';
    titleRow.getCell(1).font = { name: FONT, bold: true, size: 15, color: { argb: HEADER_FILL } };
    titleRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    titleRow.height = 24;

    const periodRow = ws.getRow(2);
    ws.mergeCells(2, 1, 2, lastCol);
    const periodText = input.periodLabel ? `Periodo: ${input.periodLabel}` : '';
    const generatedText = input.generatedLabel ? `Generado el ${input.generatedLabel}` : '';
    periodRow.getCell(1).value = [periodText, generatedText].filter(Boolean).join('    ·    ');
    periodRow.getCell(1).font = { name: FONT, bold: true, size: 11, color: { argb: BODY_TEXT } };
    periodRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    periodRow.height = 18;

    const noteRow = ws.getRow(3);
    ws.mergeCells(3, 1, 3, lastCol);
    noteRow.getCell(1).value = `Las columnas de ${input.previousYear} corresponden al mismo periodo del año anterior.`;
    noteRow.getCell(1).font = { name: FONT, italic: true, size: 10, color: { argb: MUTED_TEXT } };
    noteRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    noteRow.height = 16;
  }

  // ---- Header ----
  const labelRowObj = ws.getRow(labelRow);
  columns.forEach((c, i) => {
    labelRowObj.getCell(i + 1).value = c.header;
  });

  if (hasGroups) {
    // Group row: horizontal merges for contiguous group runs, vertical merges for null-group columns.
    let i = 0;
    while (i < columns.length) {
      const col = columns[i]!;
      if (col.group === null) {
        // Vertical merge of the label cell across both header rows.
        ws.mergeCells(headerTop, i + 1, headerTop + 1, i + 1);
        ws.getCell(headerTop, i + 1).value = col.header;
        i += 1;
      } else {
        let j = i;
        while (j + 1 < columns.length && columns[j + 1]!.group === col.group) j += 1;
        ws.mergeCells(headerTop, i + 1, headerTop, j + 1);
        ws.getCell(headerTop, i + 1).value = col.group === 'billing' ? input.billingLabel : GROUP_MARGIN_LABEL;
        i = j + 1;
      }
    }
  }

  // Header styling — group row (if any) a touch lighter than the label row.
  const groupFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GROUP_HEADER_FILL } };
  const labelFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  for (let r = headerTop; r <= labelRow; r++) {
    const row = ws.getRow(r);
    const isGroupRow = hasGroups && r === headerTop;
    row.height = isGroupRow ? 20 : 30;
    columns.forEach((_, i) => {
      const cell = row.getCell(i + 1);
      cell.font = { name: FONT, bold: true, size: 11, color: { argb: HEADER_TEXT } };
      cell.fill = isGroupRow ? groupFill : labelFill;
      cell.alignment = { horizontal: i === 0 ? 'left' : 'center', vertical: 'middle', wrapText: true };
      cell.border = { bottom: { style: 'thin', color: { argb: BORDER } } };
    });
  }

  // ---- Data + TOTAL rows ----
  // numFmt + alignment come from the column-level style; here we set font color
  // (heatmap), zebra striping, and the TOTAL row emphasis.
  const zebraFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA_FILL } };
  const totalFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_FILL } };
  const totalBorder: Partial<ExcelJS.Borders> = { top: { style: 'medium', color: { argb: TOTAL_BORDER } } };

  let dataIndex = 0;
  const writeDataRow = (row: ExportRow, isTotal: boolean): void => {
    const values = columns.map((c) => c.value(row) ?? null);
    const excelRow = ws.addRow(values);
    const zebra = !isTotal && dataIndex % 2 === 1;
    columns.forEach((c, i) => {
      const cell = excelRow.getCell(i + 1);
      const hasValue = values[i] !== null;
      // Body font/alignment/numFmt come from the column style; only override per
      // cell when a heatmap color applies or on the (small) TOTAL row.
      if (c.color && hasValue) {
        cell.font = { name: FONT, bold: isTotal, color: { argb: toArgb(c.color(row)) } };
      } else if (isTotal) {
        cell.font = { name: FONT, bold: true, color: { argb: BODY_TEXT } };
      }
      if (isTotal) {
        cell.fill = totalFill;
        cell.border = totalBorder;
      } else if (zebra) {
        cell.fill = zebraFill;
      }
    });
    if (!isTotal) dataIndex += 1;
  };

  for (const row of input.rows) writeDataRow(row, false);
  writeDataRow(input.totals, true);

  // ---- Autofilter on the column-label row ----
  ws.autoFilter = {
    from: { row: labelRow, column: 1 },
    to: { row: labelRow, column: columns.length },
  };

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}
