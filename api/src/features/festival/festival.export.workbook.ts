import ExcelJS from 'exceljs';
import { toArgb, complianceColor } from '../list/list.export.heatmap.js';
import type { FestivalListRow } from './festival.schemas.js';

export interface FestivalWorkbookInput {
  rows: FestivalListRow[];
  /** Header of the dimension column (e.g. "Proveedor"). */
  dimensionLabel: string;
  /** Show the budget columns (only when the grouping carries a budget). */
  includeBudget: boolean;
  /** Hide Numérica (grouping by customer → always 1). */
  hideNumerica: boolean;
  /** Hide Items (grouping by product → always 1). */
  hideItems: boolean;
  reportTitle?: string;
  periodLabel?: string;
  generatedLabel?: string;
}

type ColFormat = 'text' | 'currency' | 'percent' | 'integer';

interface FestivalExcelColumn {
  header: string;
  format: ColFormat;
  width: number;
  value: (row: FestivalListRow) => number | string | null;
  color?: (row: FestivalListRow) => string; // hex6, no '#'
}

const NUM_FMT: Record<ColFormat, string | undefined> = {
  text: undefined,
  currency: '"$"#,##0',
  percent: '#,##0.00"%"',
  integer: '#,##0',
};

// Palette (ARGB) — same tone as the list export workbook.
const FONT = 'Calibri';
const HEADER_FILL = 'FF1E293B'; // slate-800
const HEADER_TEXT = 'FFFFFFFF';
const BODY_TEXT = 'FF334155';
const MUTED_TEXT = 'FF64748B';
const ZEBRA_FILL = 'FFF8FAFC'; // slate-50
const BORDER = 'FFE2E8F0';

/** Ordered festival columns — mirrors the on-screen listing. */
function buildColumns(input: FestivalWorkbookInput): FestivalExcelColumn[] {
  const total = input.rows.reduce((sum, r) => sum + r.sales_total, 0);

  const cols: (FestivalExcelColumn | null)[] = [
    {
      header: input.dimensionLabel, format: 'text', width: 34,
      value: (r) => r.name,
    },
    {
      header: '% Ventas', format: 'percent', width: 12,
      value: (r) => (total > 0 ? (r.sales_total / total) * 100 : 0),
    },
    {
      header: 'Ventas (Facturado + Comprometido)', format: 'currency', width: 20,
      value: (r) => r.sales_total,
    },
    input.includeBudget
      ? {
          header: 'Ppto Festival', format: 'currency', width: 16,
          value: (r) => r.presupuesto,
        }
      : null,
    input.includeBudget
      ? {
          header: '% Cumpl. Ppto', format: 'percent', width: 14,
          value: (r) => r.cumplimiento_ppto,
          color: (r) => complianceColor(r.cumplimiento_ppto ?? 0),
        }
      : null,
    {
      header: 'Comprometido', format: 'currency', width: 16,
      value: (r) => r.comprometido,
    },
    {
      header: 'Margen Bruto %', format: 'percent', width: 14,
      value: (r) => r.gross_margin_pct,
    },
    {
      header: 'Margen Recuperado %', format: 'percent', width: 16,
      value: (r) => r.rappel_pct,
    },
    {
      header: 'Margen Total %', format: 'percent', width: 14,
      value: (r) => r.margen_rappel_pct,
    },
    {
      header: 'Pedido Promedio', format: 'currency', width: 16,
      value: (r) => r.pedido_promedio,
    },
    input.hideNumerica
      ? null
      : {
          header: 'Numérica', format: 'integer', width: 12,
          value: (r) => r.clientes_unicos,
        },
    input.hideItems
      ? null
      : {
          header: 'Items', format: 'integer', width: 12,
          value: (r) => r.productos_unicos,
        },
  ];

  return cols.filter((c): c is FestivalExcelColumn => c !== null);
}

export async function buildFestivalExportWorkbook(input: FestivalWorkbookInput): Promise<Buffer> {
  const columns = buildColumns(input);
  const lastCol = columns.length;

  // Optional report title block above the table (title, period, spacer).
  const hasTitle = Boolean(input.reportTitle || input.periodLabel);
  const topOffset = hasTitle ? 3 : 0;
  const headerRow = topOffset + 1;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Festival', {
    views: [{ state: 'frozen', xSplit: 1, ySplit: headerRow }],
  });

  // Column-level width + default numFmt/alignment (fast for large exports).
  ws.columns = columns.map((c) => {
    const fmt = NUM_FMT[c.format];
    const style: Partial<ExcelJS.Style> = {
      alignment: { horizontal: c.format === 'text' ? 'left' : 'right' },
      font: { name: FONT, color: { argb: BODY_TEXT } },
    };
    if (fmt) style.numFmt = fmt;
    return { width: c.width, style };
  });

  if (hasTitle) {
    const titleRow = ws.getRow(1);
    ws.mergeCells(1, 1, 1, lastCol);
    titleRow.getCell(1).value = input.reportTitle || 'Festival Virtual';
    titleRow.getCell(1).font = { name: FONT, bold: true, size: 15, color: { argb: HEADER_FILL } };
    titleRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    titleRow.height = 24;

    const periodRow = ws.getRow(2);
    ws.mergeCells(2, 1, 2, lastCol);
    const periodText = input.periodLabel ? `Evento: ${input.periodLabel}` : '';
    const generatedText = input.generatedLabel ? `Generado el ${input.generatedLabel}` : '';
    periodRow.getCell(1).value = [periodText, generatedText].filter(Boolean).join('    ·    ');
    periodRow.getCell(1).font = { name: FONT, bold: true, size: 11, color: { argb: MUTED_TEXT } };
    periodRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    periodRow.height = 18;
  }

  // ---- Header ----
  const header = ws.getRow(headerRow);
  header.height = 30;
  columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: FONT, bold: true, size: 11, color: { argb: HEADER_TEXT } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.alignment = { horizontal: i === 0 ? 'left' : 'center', vertical: 'middle', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: BORDER } } };
  });

  // ---- Data rows (zebra striping; heatmap color where defined) ----
  const zebraFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA_FILL } };
  input.rows.forEach((row, index) => {
    const values = columns.map((c) => c.value(row) ?? null);
    const excelRow = ws.addRow(values);
    columns.forEach((c, i) => {
      const cell = excelRow.getCell(i + 1);
      if (c.color && values[i] !== null) {
        cell.font = { name: FONT, color: { argb: toArgb(c.color(row)) } };
      }
      if (index % 2 === 1) cell.fill = zebraFill;
    });
  });

  ws.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: headerRow, column: lastCol },
  };

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}
