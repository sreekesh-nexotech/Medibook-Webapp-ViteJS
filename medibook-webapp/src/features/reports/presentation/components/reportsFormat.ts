import { fmtDate, money } from '@/shared/lib/format';
import type { StatCardData } from '@/shared/ui/StatCard';

import type {
  ReportColumnDef,
  ReportKpiValue,
  ReportValue,
  ReportValueKind,
} from '@/features/reports/domain/entities/reports.entities';
import type { ReportCell } from '@/features/reports/application/store/reports.types';

import type { ReportCatalogItem } from '../reports.design';
import { CAT_ICON_CLASS } from '../reports.data';

/**
 * How report values read on screen. The server sends raw enum values and
 * typed numbers; this is the one place they become text, badges and tiles.
 */

const EMPTY = '—';
const BP_PER_PERCENT = 100;
const PERCENT_DECIMALS = 2;
/** `yyyy-mm-ddThh:mm…` → the date and the `hh:mm` parts. */
const ISO_DATE_LENGTH = 10;
const ISO_TIME_START = 11;
const ISO_TIME_END = 16;

/** Readable labels for the raw status / method values reports carry. */
const VALUE_LABELS: Readonly<Record<string, string>> = {
  // appointments
  pending_approval: 'Pending',
  scheduled: 'Scheduled',
  checked_in: 'Checked-in',
  in_consultation: 'In consultation',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
  // payments
  captured: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
  pending: 'Pending',
  upi: 'UPI',
  card: 'Card',
  netbanking: 'Net banking',
  wallet: 'Wallet',
  emi: 'EMI',
  paylater: 'Pay later',
  cash: 'Cash',
  pos: 'POS',
  // settlement periods
  open: 'Open',
  closed: 'Closed',
  paid: 'Paid',
  on_hold: 'On Hold',
};

/** Columns whose raw enum values are shown as readable labels. */
const ENUM_COLUMNS: ReadonlySet<string> = new Set(['status', 'method']);

const NUMERIC_KINDS: ReadonlySet<ReportValueKind> = new Set(['int', 'rupees', 'bp', 'percent']);

/** `no_show` → "No-show"; unknown values → sentence case with spaces. */
export function valueLabel(raw: string): string {
  const known = VALUE_LABELS[raw];
  if (known) return known;
  const spaced = raw.replaceAll('_', ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function isNumericKind(kind: ReportValueKind): boolean {
  return NUMERIC_KINDS.has(kind);
}

/** One value as display text. */
export function formatValue(value: ReportValue, kind: ReportValueKind): string {
  if (value === null || value === '') return EMPTY;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    if (kind === 'rupees') return money(value);
    if (kind === 'bp') return `${(value / BP_PER_PERCENT).toFixed(PERCENT_DECIMALS)}%`;
    if (kind === 'percent') return `${value.toFixed(PERCENT_DECIMALS)}%`;
    return value.toLocaleString('en-IN');
  }
  if (kind === 'date') return fmtDate(value.slice(0, ISO_DATE_LENGTH));
  if (kind === 'datetime') {
    return `${fmtDate(value.slice(0, ISO_DATE_LENGTH))}, ${value.slice(ISO_TIME_START, ISO_TIME_END)}`;
  }
  return value;
}

/** One table cell: enum columns as badges, numbers right-aligned, the first column emphasised. */
export function cellFor(column: ReportColumnDef, value: ReportValue, isFirst: boolean): ReportCell {
  if (ENUM_COLUMNS.has(column.key) && typeof value === 'string' && value !== '') {
    const label = valueLabel(value);
    return column.key === 'status'
      ? { kind: 'badge', status: label }
      : { kind: 'text', text: label };
  }
  const text = formatValue(value, column.kind);
  return isNumericKind(column.kind)
    ? { kind: 'num', text }
    : { kind: 'text', text, strong: isFirst };
}

/** One KPI tile, tinted with the report's category colour. */
export function kpiTile(kpi: ReportKpiValue, item: ReportCatalogItem): StatCardData {
  return {
    icon:
      kpi.kind === 'rupees'
        ? 'indian-rupee'
        : kpi.kind === 'percent' || kpi.kind === 'bp'
          ? 'percent'
          : item.icon,
    label: kpi.label,
    value: formatValue(kpi.value, kpi.kind),
    sub: 'Across the filtered rows',
    iconClass: CAT_ICON_CLASS[item.cat],
    valueClass: 'text-text-strong',
    subClass: 'text-text-muted',
  };
}

const BYTES_PER_KB = 1024;

/** 2_400_000 → "2.3 MB"; 900 → "900 B". */
export function fileSizeCopy(bytes: number): string {
  if (bytes < BYTES_PER_KB) return `${bytes} B`;
  const kb = bytes / BYTES_PER_KB;
  return kb < BYTES_PER_KB ? `${kb.toFixed(1)} KB` : `${(kb / BYTES_PER_KB).toFixed(1)} MB`;
}
