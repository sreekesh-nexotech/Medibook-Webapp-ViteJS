/**
 * Everything the fourteen reports are made of — audit HA-13: "each shows four
 * fixed tiles with no data table, and the filters change nothing".
 *
 * One direction of data: **filter the facts → build the table → derive the
 * tiles from the same filtered rows.** Because the tiles are derived last,
 * changing any filter visibly moves them, which is what proves the filters
 * work. The CSV export writes the same rows the table draws.
 *
 * Pure functions only: no React, no store, no formatting decisions the screen
 * cannot override.
 */

import type { CsvCell } from '@/shared/lib/download';
import type { SortAccessors, SortValue } from '@/shared/hooks/useSort';
import { fmtDate, money, moneyShort, timeToMinutes } from '@/shared/lib/format';
import type { IconName } from '@/shared/ui/icon-registry';

import type { AuditEntry } from '@/features/audit/application/store/audit.types';
import type { Settlement } from '@/features/settlements/application/store/settlements.types';

import type {
  ReportCell,
  ReportFact,
  ReportFilter,
  ReportFilterState,
  ReportKpi,
  ReportTable,
  ReportTableRow,
} from './reports.types';

/* ------------------------------------------------------------- sentinels */

export const ALL_DEPARTMENTS = 'All Departments';
export const ALL_DOCTORS = 'All Doctors';
export const ALL_STATUS = 'All Status';
export const ALL_SOURCES = 'All Sources';
export const ALL_MODES = 'All Modes';
export const ALL_USERS = 'All Users';

/** No filter applied — the state a freshly opened report starts in. */
export const EMPTY_FILTERS: ReportFilterState = {
  from: '',
  to: '',
  dept: ALL_DEPARTMENTS,
  doctor: ALL_DOCTORS,
  status: ALL_STATUS,
  source: ALL_SOURCES,
  mode: ALL_MODES,
  user: ALL_USERS,
};

/** True when anything in the toolbar is actually narrowing the rows. */
export function hasActiveFilters(f: ReportFilterState): boolean {
  return (
    f.from !== '' ||
    f.to !== '' ||
    f.dept !== ALL_DEPARTMENTS ||
    f.doctor !== ALL_DOCTORS ||
    f.status !== ALL_STATUS ||
    f.source !== ALL_SOURCES ||
    f.mode !== ALL_MODES ||
    f.user !== ALL_USERS
  );
}

/* ---------------------------------------------------------------- filters */

/**
 * Narrow the fact table by the filters the report actually shows. A filter a
 * report does not offer is never applied, so a hidden control can never
 * silently change a total.
 */
export function filterFacts(
  facts: readonly ReportFact[],
  shown: readonly ReportFilter[],
  f: ReportFilterState,
): readonly ReportFact[] {
  const has = (name: ReportFilter): boolean => shown.includes(name);
  return facts.filter((r) => {
    if (has('date') && f.from !== '' && r.date < f.from) return false;
    if (has('date') && f.to !== '' && r.date > f.to) return false;
    if (has('dept') && f.dept !== ALL_DEPARTMENTS && r.dept !== f.dept) return false;
    if (has('doctor') && f.doctor !== ALL_DOCTORS && r.doctor !== f.doctor) return false;
    if (has('status') && f.status !== ALL_STATUS && r.status !== f.status) return false;
    if (has('source') && f.source !== ALL_SOURCES && r.source !== f.source) return false;
    if (has('mode') && f.mode !== ALL_MODES && r.mode !== f.mode) return false;
    if (has('user') && f.user !== ALL_USERS && r.bookedBy !== f.user) return false;
    return true;
  });
}

/** Narrow the settlement ledger — the settlement report's own row source. */
export function filterSettlements(
  settlements: readonly Settlement[],
  shown: readonly ReportFilter[],
  f: ReportFilterState,
): readonly Settlement[] {
  const has = (name: ReportFilter): boolean => shown.includes(name);
  return settlements.filter((s) => {
    if (has('date') && f.from !== '' && s.expected < f.from) return false;
    if (has('date') && f.to !== '' && s.expected > f.to) return false;
    if (has('status') && f.status !== ALL_STATUS && s.status !== f.status) return false;
    return true;
  });
}

/** Narrow the audit trail — the user-activity report's row source. */
export function filterAudit(
  entries: readonly AuditEntry[],
  shown: readonly ReportFilter[],
  f: ReportFilterState,
): readonly AuditEntry[] {
  const has = (name: ReportFilter): boolean => shown.includes(name);
  return entries.filter((e) => {
    if (has('date') && f.from !== '' && e.date < f.from) return false;
    if (has('date') && f.to !== '' && e.date > f.to) return false;
    if (has('user') && f.user !== ALL_USERS && e.actor !== f.user) return false;
    return true;
  });
}

/** Status options a report's status filter should offer. */
export function statusOptionsFor(reportId: string): readonly string[] {
  if (reportId === 'settlement') {
    return [ALL_STATUS, 'Pending', 'Overdue', 'Released', 'Received', 'Payout failed'];
  }
  if (reportId === 'cancellation') return [ALL_STATUS, 'Cancelled', 'No-show'];
  return [ALL_STATUS, 'Scheduled', 'In Queue', 'Completed', 'Cancelled', 'No-show'];
}

/* ------------------------------------------------------------ table maker */

/** One column of a report: how to draw it, sort it and write it to CSV. */
interface ColSpec<R> {
  readonly label: string;
  /** Right-align (numbers, money). */
  readonly right?: boolean;
  /** Sort key; omit to make the column unsortable. */
  readonly sortKey?: string;
  readonly cell: (row: R) => ReportCell;
  /** Sort value; defaults to the cell's own text. */
  readonly value?: (row: R) => SortValue;
  readonly csv: (row: R) => CsvCell;
}

interface TableSpec<R> {
  readonly rows: readonly R[];
  readonly id: (row: R) => string;
  readonly cols: readonly ColSpec<R>[];
  readonly noun: string;
  readonly rowMeaning: string;
}

/** The text a cell shows, for the default sort value. */
function cellText(cell: ReportCell): string {
  return cell.kind === 'badge' ? (cell.label ?? cell.status) : cell.text;
}

/** Assemble a `ReportTable` from typed rows + column specs. */
function buildTable<R>(spec: TableSpec<R>): ReportTable {
  const sortKeys: Record<string, string> = {};
  for (const c of spec.cols) if (c.sortKey) sortKeys[c.label] = c.sortKey;

  const rows: ReportTableRow[] = spec.rows.map((row) => {
    const cells = spec.cols.map((c) => c.cell(row));
    const sortValues: Record<string, SortValue> = {};
    spec.cols.forEach((c, i) => {
      if (!c.sortKey) return;
      sortValues[c.sortKey] = c.value ? c.value(row) : cellText(cells[i]);
    });
    return {
      id: spec.id(row),
      cells,
      sortValues,
      csv: spec.cols.map((c) => c.csv(row)),
    };
  });

  return {
    columns: spec.cols.map((c) => c.label),
    rightCols: spec.cols.filter((c) => c.right).map((c) => c.label),
    sortKeys,
    rows,
    noun: spec.noun,
    rowMeaning: spec.rowMeaning,
  };
}

/* ---------------------------------------------------------------- helpers */

function sum<T>(rows: readonly T[], pick: (row: T) => number): number {
  return rows.reduce((total, row) => total + pick(row), 0);
}

function groupBy<T>(rows: readonly T[], key: (row: T) => string): ReadonlyMap<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const bucket = out.get(k);
    if (bucket) bucket.push(row);
    else out.set(k, [row]);
  }
  return out;
}

/** `12` of `48` as "25.0%" (and "—" when there is nothing to divide by). */
function share(part: number, whole: number): string {
  return whole === 0 ? '—' : `${((part / whole) * 100).toFixed(1)}%`;
}

const text = (value: string, sub?: string, strong?: boolean): ReportCell => ({
  kind: 'text',
  text: value,
  sub,
  strong,
});

const num = (value: string, sub?: string): ReportCell => ({ kind: 'num', text: value, sub });

const badge = (status: string, label?: string): ReportCell => ({ kind: 'badge', status, label });

/* ------------------------------------------------------------- KPI tints */

interface KpiColor {
  readonly iconClass: string;
  readonly valueClass: string;
}
const G: KpiColor = { iconClass: 'bg-g-100 text-g-600', valueClass: 'text-g-600' };
const B: KpiColor = { iconClass: 'bg-blue-soft-bg text-blue', valueClass: 'text-blue' };
const Y: KpiColor = { iconClass: 'bg-y-100 text-y-600', valueClass: 'text-y-600' };
const P: KpiColor = { iconClass: 'bg-p-100 text-p-500', valueClass: 'text-p-500' };
const D: KpiColor = { iconClass: 'bg-d-100 text-d-500', valueClass: 'text-d-500' };

function kpi(
  icon: IconName,
  label: string,
  value: string,
  sub: string,
  color: KpiColor,
): ReportKpi {
  return {
    icon,
    label,
    value,
    sub,
    iconClass: color.iconClass,
    valueClass: color.valueClass,
    subClass: 'text-text-muted',
  };
}

/* ------------------------------------------------------- derived groupings */

interface DayGroup {
  readonly date: string;
  readonly rows: readonly ReportFact[];
}

function byDate(facts: readonly ReportFact[]): readonly DayGroup[] {
  return [...groupBy(facts, (r) => r.date).entries()]
    .map(([date, rows]) => ({ date, rows }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

interface DoctorGroup {
  readonly doctor: string;
  readonly dept: string;
  readonly rows: readonly ReportFact[];
}

function byDoctor(facts: readonly ReportFact[]): readonly DoctorGroup[] {
  return [...groupBy(facts, (r) => r.doctor).entries()]
    .map(([doctor, rows]) => ({ doctor, dept: rows[0]?.dept ?? '—', rows }))
    .sort((a, b) => a.doctor.localeCompare(b.doctor));
}

interface DeptGroup {
  readonly dept: string;
  readonly rows: readonly ReportFact[];
}

function byDept(facts: readonly ReportFact[]): readonly DeptGroup[] {
  return [...groupBy(facts, (r) => r.dept).entries()]
    .map(([dept, rows]) => ({ dept, rows }))
    .sort((a, b) => a.dept.localeCompare(b.dept));
}

interface PatientGroup {
  readonly mrn: string;
  readonly rows: readonly ReportFact[];
}

function byPatient(facts: readonly ReportFact[]): readonly PatientGroup[] {
  return [...groupBy(facts, (r) => r.mrn).entries()]
    .map(([mrn, rows]) => ({ mrn, rows }))
    .sort((a, b) => b.rows.length - a.rows.length || a.mrn.localeCompare(b.mrn));
}

interface ActorDayGroup {
  readonly key: string;
  readonly date: string;
  readonly actor: string;
  readonly rows: readonly AuditEntry[];
}

function byActorDay(entries: readonly AuditEntry[]): readonly ActorDayGroup[] {
  return [...groupBy(entries, (e) => `${e.date}|${e.actor}`).entries()]
    .map(([key, rows]) => ({
      key,
      date: rows[0]?.date ?? '',
      actor: rows[0]?.actor ?? '',
      rows,
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.actor.localeCompare(b.actor));
}

/** Completed / cancelled / no-show counts of a bucket. */
function outcomes(rows: readonly ReportFact[]) {
  return {
    total: rows.length,
    completed: rows.filter((r) => r.status === 'Completed').length,
    cancelled: rows.filter((r) => r.status === 'Cancelled').length,
    noShow: rows.filter((r) => r.status === 'No-show').length,
    online: rows.filter((r) => r.source === 'Online').length,
    walkIn: rows.filter((r) => r.source === 'Walk-in').length,
    collected: sum(rows, (r) => r.collected),
    onlineCollected: sum(
      rows.filter((r) => r.source === 'Online'),
      (r) => r.collected,
    ),
    walkInCollected: sum(
      rows.filter((r) => r.source === 'Walk-in'),
      (r) => r.collected,
    ),
    refunds: sum(rows, (r) => r.refund),
    commission: sum(rows, (r) => r.commission),
  };
}

/** Average rating of a bucket, or null when nothing is rated. */
function avgRating(rows: readonly ReportFact[]): number | null {
  const rated = rows.filter((r) => r.rating != null);
  if (rated.length === 0) return null;
  return sum(rated, (r) => r.rating ?? 0) / rated.length;
}

/**
 * Sort accessors for a built table: one per sortable column's sort key,
 * reading the value the table already computed. Bind straight to `useSort`.
 */
export function reportSortAccessors(table: ReportTable): SortAccessors<ReportTableRow> {
  const acc: Record<string, (row: ReportTableRow) => SortValue> = {};
  for (const key of Object.values(table.sortKeys)) acc[key] = (row) => row.sortValues[key];
  return acc;
}

/* ----------------------------------------------------------- the reports */

/** Row sources a report may read, already filtered by the screen. */
export interface ReportContext {
  readonly facts: readonly ReportFact[];
  readonly settlements: readonly Settlement[];
  readonly audit: readonly AuditEntry[];
}

/** The table for one report id, built from the filtered context. */
export function buildReportTable(reportId: string, ctx: ReportContext): ReportTable {
  const facts = ctx.facts;

  switch (reportId) {
    case 'appointment':
      return buildTable({
        rows: [...facts].sort((a, b) => b.date.localeCompare(a.date)),
        id: (r) => r.id,
        noun: 'appointments',
        rowMeaning: 'One row per appointment in the selected range.',
        cols: [
          {
            label: 'Date',
            sortKey: 'date',
            cell: (r) => text(fmtDate(r.date), r.time),
            value: (r) => `${r.date} ${String(timeToMinutes(r.time)).padStart(4, '0')}`,
            csv: (r) => r.date,
          },
          {
            label: 'Patient',
            sortKey: 'patient',
            cell: (r) => text(r.patient, r.mrn, true),
            value: (r) => r.patient,
            csv: (r) => r.patient,
          },
          {
            label: 'Department',
            sortKey: 'dept',
            cell: (r) => text(r.dept),
            csv: (r) => r.dept,
          },
          {
            label: 'Doctor',
            sortKey: 'doctor',
            cell: (r) => text(r.doctor),
            csv: (r) => r.doctor,
          },
          { label: 'Source', sortKey: 'source', cell: (r) => text(r.source), csv: (r) => r.source },
          {
            label: 'Status',
            sortKey: 'status',
            cell: (r) => badge(r.status),
            csv: (r) => r.status,
          },
          {
            label: 'Fee',
            right: true,
            sortKey: 'fee',
            cell: (r) => num(money(r.fee)),
            value: (r) => r.fee,
            csv: (r) => r.fee,
          },
        ],
      });

    case 'booking':
      return buildTable({
        rows: [...facts].sort((a, b) => b.bookedOn.localeCompare(a.bookedOn)),
        id: (r) => r.id,
        noun: 'bookings',
        rowMeaning: 'One row per booking, by the day it was made.',
        cols: [
          {
            label: 'Booked On',
            sortKey: 'bookedOn',
            cell: (r) => text(fmtDate(r.bookedOn), r.bookedBy),
            value: (r) => r.bookedOn,
            csv: (r) => r.bookedOn,
          },
          {
            label: 'Booking Ref',
            sortKey: 'ref',
            cell: (r) => text(r.bookingRef),
            csv: (r) => r.bookingRef,
          },
          {
            label: 'Patient',
            sortKey: 'patient',
            cell: (r) => text(r.patient, r.mrn, true),
            value: (r) => r.patient,
            csv: (r) => r.patient,
          },
          { label: 'Department', sortKey: 'dept', cell: (r) => text(r.dept), csv: (r) => r.dept },
          { label: 'Doctor', sortKey: 'doctor', cell: (r) => text(r.doctor), csv: (r) => r.doctor },
          {
            label: 'Channel',
            sortKey: 'source',
            cell: (r) => badge(r.source === 'Online' ? 'Medibook' : 'Walk-in', r.source),
            value: (r) => r.source,
            csv: (r) => r.source,
          },
          {
            label: 'Slot',
            sortKey: 'slot',
            cell: (r) => text(`${fmtDate(r.date)} · ${r.time}`),
            value: (r) => `${r.date} ${String(timeToMinutes(r.time)).padStart(4, '0')}`,
            csv: (r) => `${r.date} ${r.time}`,
          },
          {
            label: 'Lead time',
            right: true,
            sortKey: 'lead',
            cell: (r) => {
              const days = Math.round(
                (Date.parse(`${r.date}T12:00:00`) - Date.parse(`${r.bookedOn}T12:00:00`)) /
                  86400000,
              );
              return num(days === 0 ? 'Same day' : `${days} d`);
            },
            value: (r) =>
              Math.round(
                (Date.parse(`${r.date}T12:00:00`) - Date.parse(`${r.bookedOn}T12:00:00`)) /
                  86400000,
              ),
            csv: (r) =>
              Math.round(
                (Date.parse(`${r.date}T12:00:00`) - Date.parse(`${r.bookedOn}T12:00:00`)) /
                  86400000,
              ),
          },
        ],
      });

    case 'revenue':
      return buildTable({
        rows: [...byDate(facts)].reverse(),
        id: (g) => g.date,
        noun: 'days',
        rowMeaning: 'One row per day, summing the collections of that day.',
        cols: [
          {
            label: 'Date',
            sortKey: 'date',
            cell: (g) => text(fmtDate(g.date), `${g.rows.length} appointments`, true),
            value: (g) => g.date,
            csv: (g) => g.date,
          },
          {
            label: 'Appointments',
            right: true,
            sortKey: 'count',
            cell: (g) => num(String(g.rows.length)),
            value: (g) => g.rows.length,
            csv: (g) => g.rows.length,
          },
          {
            label: 'Online',
            right: true,
            sortKey: 'online',
            cell: (g) => num(money(outcomes(g.rows).onlineCollected)),
            value: (g) => outcomes(g.rows).onlineCollected,
            csv: (g) => outcomes(g.rows).onlineCollected,
          },
          {
            label: 'Walk-in',
            right: true,
            sortKey: 'walkin',
            cell: (g) => num(money(outcomes(g.rows).walkInCollected)),
            value: (g) => outcomes(g.rows).walkInCollected,
            csv: (g) => outcomes(g.rows).walkInCollected,
          },
          {
            label: 'Refunds',
            right: true,
            sortKey: 'refunds',
            cell: (g) => num(money(outcomes(g.rows).refunds)),
            value: (g) => outcomes(g.rows).refunds,
            csv: (g) => outcomes(g.rows).refunds,
          },
          {
            label: 'Net Collected',
            right: true,
            sortKey: 'net',
            cell: (g) => {
              const o = outcomes(g.rows);
              return num(money(o.collected - o.refunds));
            },
            value: (g) => {
              const o = outcomes(g.rows);
              return o.collected - o.refunds;
            },
            csv: (g) => {
              const o = outcomes(g.rows);
              return o.collected - o.refunds;
            },
          },
          {
            label: 'Avg / appointment',
            right: true,
            sortKey: 'avg',
            cell: (g) =>
              num(
                g.rows.length === 0
                  ? '—'
                  : money(Math.round(outcomes(g.rows).collected / g.rows.length)),
              ),
            value: (g) =>
              g.rows.length === 0 ? 0 : Math.round(outcomes(g.rows).collected / g.rows.length),
            csv: (g) =>
              g.rows.length === 0 ? 0 : Math.round(outcomes(g.rows).collected / g.rows.length),
          },
        ],
      });

    case 'payment':
      return buildTable({
        rows: [...facts.filter((r) => r.collected > 0)].sort((a, b) =>
          b.date.localeCompare(a.date),
        ),
        id: (r) => r.id,
        noun: 'payments',
        rowMeaning: 'One row per payment received, at the desk or online.',
        cols: [
          {
            label: 'Receipt',
            sortKey: 'receipt',
            cell: (r) => text(r.receipt ?? '—', r.bookingRef, true),
            value: (r) => r.receipt ?? '',
            csv: (r) => r.receipt ?? '',
          },
          {
            label: 'Date',
            sortKey: 'date',
            cell: (r) => text(fmtDate(r.date), r.time),
            value: (r) => r.date,
            csv: (r) => r.date,
          },
          {
            label: 'Patient',
            sortKey: 'patient',
            cell: (r) => text(r.patient, r.mrn),
            value: (r) => r.patient,
            csv: (r) => r.patient,
          },
          {
            label: 'Mode',
            sortKey: 'mode',
            cell: (r) => text(r.mode),
            csv: (r) => r.mode,
          },
          {
            label: 'Channel',
            sortKey: 'source',
            cell: (r) => text(r.source),
            csv: (r) => r.source,
          },
          {
            label: 'Amount',
            right: true,
            sortKey: 'amount',
            cell: (r) => num(money(r.collected)),
            value: (r) => r.collected,
            csv: (r) => r.collected,
          },
          {
            label: 'Status',
            sortKey: 'status',
            cell: (r) => badge(r.refund > 0 ? 'Refunded' : 'Paid'),
            value: (r) => (r.refund > 0 ? 'Refunded' : 'Paid'),
            csv: (r) => (r.refund > 0 ? 'Refunded' : 'Paid'),
          },
        ],
      });

    case 'refund':
      return buildTable({
        rows: [...facts.filter((r) => r.refund > 0)].sort((a, b) => b.date.localeCompare(a.date)),
        id: (r) => r.id,
        noun: 'refunds',
        rowMeaning: 'One row per refund Medibook processed on a cancellation.',
        cols: [
          {
            label: 'Date',
            sortKey: 'date',
            cell: (r) => text(fmtDate(r.date)),
            value: (r) => r.date,
            csv: (r) => r.date,
          },
          {
            label: 'Booking Ref',
            sortKey: 'ref',
            cell: (r) => text(r.bookingRef, r.receipt ?? undefined, true),
            value: (r) => r.bookingRef,
            csv: (r) => r.bookingRef,
          },
          {
            label: 'Patient',
            sortKey: 'patient',
            cell: (r) => text(r.patient, r.mrn),
            value: (r) => r.patient,
            csv: (r) => r.patient,
          },
          { label: 'Doctor', sortKey: 'doctor', cell: (r) => text(r.doctor), csv: (r) => r.doctor },
          {
            label: 'Fee',
            right: true,
            sortKey: 'fee',
            cell: (r) => num(money(r.fee)),
            value: (r) => r.fee,
            csv: (r) => r.fee,
          },
          {
            label: 'Refunded',
            right: true,
            sortKey: 'refund',
            cell: (r) => num(money(r.refund), share(r.refund, r.fee)),
            value: (r) => r.refund,
            csv: (r) => r.refund,
          },
          {
            label: 'Retained',
            right: true,
            sortKey: 'retained',
            cell: (r) => num(money(r.fee - r.refund)),
            value: (r) => r.fee - r.refund,
            csv: (r) => r.fee - r.refund,
          },
          { label: 'Reason', sortKey: 'reason', cell: (r) => text(r.reason), csv: (r) => r.reason },
        ],
      });

    case 'settlement':
      return buildTable({
        rows: [...ctx.settlements].sort((a, b) => b.expected.localeCompare(a.expected)),
        id: (s) => s.id,
        noun: 'statements',
        rowMeaning: 'One row per weekly settlement statement from Medibook.',
        cols: [
          {
            label: 'Statement',
            sortKey: 'id',
            cell: (s) => text(s.id, s.utr ?? 'No UTR yet', true),
            value: (s) => s.id,
            csv: (s) => s.id,
          },
          {
            label: 'Period',
            sortKey: 'period',
            cell: (s) => text(s.period),
            csv: (s) => s.period,
          },
          {
            label: 'Gross',
            right: true,
            sortKey: 'gross',
            cell: (s) => num(money(s.gross)),
            value: (s) => s.gross,
            csv: (s) => s.gross,
          },
          {
            label: 'Commission',
            right: true,
            sortKey: 'commission',
            cell: (s) => num(money(s.commission)),
            value: (s) => s.commission,
            csv: (s) => s.commission,
          },
          {
            label: 'Net',
            right: true,
            sortKey: 'net',
            cell: (s) => num(money(s.net)),
            value: (s) => s.net,
            csv: (s) => s.net,
          },
          {
            label: 'Expected',
            sortKey: 'expected',
            cell: (s) =>
              text(
                fmtDate(s.expected),
                s.receivedOn ? `Received ${fmtDate(s.receivedOn)}` : undefined,
              ),
            value: (s) => s.expected,
            csv: (s) => s.expected,
          },
          {
            label: 'Status',
            sortKey: 'status',
            cell: (s) => badge(s.status),
            csv: (s) => s.status,
          },
        ],
      });

    case 'commission':
      return buildTable({
        rows: [...facts.filter((r) => r.commission > 0)].sort((a, b) =>
          b.date.localeCompare(a.date),
        ),
        id: (r) => r.id,
        noun: 'online bookings',
        rowMeaning: 'One row per online booking Medibook charged commission on.',
        cols: [
          {
            label: 'Date',
            sortKey: 'date',
            cell: (r) => text(fmtDate(r.date)),
            value: (r) => r.date,
            csv: (r) => r.date,
          },
          {
            label: 'Booking Ref',
            sortKey: 'ref',
            cell: (r) => text(r.bookingRef, r.patient, true),
            value: (r) => r.bookingRef,
            csv: (r) => r.bookingRef,
          },
          { label: 'Department', sortKey: 'dept', cell: (r) => text(r.dept), csv: (r) => r.dept },
          {
            label: 'Gross',
            right: true,
            sortKey: 'gross',
            cell: (r) => num(money(r.collected)),
            value: (r) => r.collected,
            csv: (r) => r.collected,
          },
          {
            label: 'Rate',
            right: true,
            sortKey: 'rate',
            cell: (r) => num(share(r.commission, r.collected)),
            value: (r) => (r.collected === 0 ? 0 : r.commission / r.collected),
            csv: (r) => share(r.commission, r.collected),
          },
          {
            label: 'Commission',
            right: true,
            sortKey: 'commission',
            cell: (r) => num(money(r.commission)),
            value: (r) => r.commission,
            csv: (r) => r.commission,
          },
          {
            label: 'Net to hospital',
            right: true,
            sortKey: 'net',
            cell: (r) => num(money(r.collected - r.commission)),
            value: (r) => r.collected - r.commission,
            csv: (r) => r.collected - r.commission,
          },
        ],
      });

    case 'doctor':
      return buildTable({
        rows: byDoctor(facts),
        id: (g) => g.doctor,
        noun: 'doctors',
        rowMeaning: 'One row per doctor, over the selected range.',
        cols: [
          {
            label: 'Doctor',
            sortKey: 'doctor',
            cell: (g) => text(g.doctor, g.dept, true),
            value: (g) => g.doctor,
            csv: (g) => g.doctor,
          },
          { label: 'Department', sortKey: 'dept', cell: (g) => text(g.dept), csv: (g) => g.dept },
          {
            label: 'Appointments',
            right: true,
            sortKey: 'count',
            cell: (g) => num(String(g.rows.length)),
            value: (g) => g.rows.length,
            csv: (g) => g.rows.length,
          },
          {
            label: 'Completed',
            right: true,
            sortKey: 'completed',
            cell: (g) => {
              const o = outcomes(g.rows);
              return num(String(o.completed), share(o.completed, o.total));
            },
            value: (g) => outcomes(g.rows).completed,
            csv: (g) => outcomes(g.rows).completed,
          },
          {
            label: 'Cancelled',
            right: true,
            sortKey: 'cancelled',
            cell: (g) => num(String(outcomes(g.rows).cancelled)),
            value: (g) => outcomes(g.rows).cancelled,
            csv: (g) => outcomes(g.rows).cancelled,
          },
          {
            label: 'No-show',
            right: true,
            sortKey: 'noshow',
            cell: (g) => num(String(outcomes(g.rows).noShow)),
            value: (g) => outcomes(g.rows).noShow,
            csv: (g) => outcomes(g.rows).noShow,
          },
          {
            label: 'Collected',
            right: true,
            sortKey: 'collected',
            cell: (g) => num(money(outcomes(g.rows).collected)),
            value: (g) => outcomes(g.rows).collected,
            csv: (g) => outcomes(g.rows).collected,
          },
          {
            label: 'Rating',
            right: true,
            sortKey: 'rating',
            cell: (g) => {
              const r = avgRating(g.rows);
              return num(r == null ? '—' : `${r.toFixed(1)} / 5`);
            },
            value: (g) => avgRating(g.rows),
            csv: (g) => {
              const r = avgRating(g.rows);
              return r == null ? '' : r.toFixed(1);
            },
          },
        ],
      });

    case 'department': {
      const total = sum(facts, () => 1);
      return buildTable({
        rows: byDept(facts),
        id: (g) => g.dept,
        noun: 'departments',
        rowMeaning: 'One row per department, over the selected range.',
        cols: [
          {
            label: 'Department',
            sortKey: 'dept',
            cell: (g) => text(g.dept, `${new Set(g.rows.map((r) => r.doctor)).size} doctors`, true),
            value: (g) => g.dept,
            csv: (g) => g.dept,
          },
          {
            label: 'Doctors',
            right: true,
            sortKey: 'doctors',
            cell: (g) => num(String(new Set(g.rows.map((r) => r.doctor)).size)),
            value: (g) => new Set(g.rows.map((r) => r.doctor)).size,
            csv: (g) => new Set(g.rows.map((r) => r.doctor)).size,
          },
          {
            label: 'Appointments',
            right: true,
            sortKey: 'count',
            cell: (g) => num(String(g.rows.length), share(g.rows.length, total)),
            value: (g) => g.rows.length,
            csv: (g) => g.rows.length,
          },
          {
            label: 'Completed',
            right: true,
            sortKey: 'completed',
            cell: (g) => num(String(outcomes(g.rows).completed)),
            value: (g) => outcomes(g.rows).completed,
            csv: (g) => outcomes(g.rows).completed,
          },
          {
            label: 'Collected',
            right: true,
            sortKey: 'collected',
            cell: (g) => num(money(outcomes(g.rows).collected)),
            value: (g) => outcomes(g.rows).collected,
            csv: (g) => outcomes(g.rows).collected,
          },
          {
            label: 'Avg fee',
            right: true,
            sortKey: 'avgfee',
            cell: (g) =>
              num(
                g.rows.length === 0
                  ? '—'
                  : money(Math.round(sum(g.rows, (r) => r.fee) / g.rows.length)),
              ),
            value: (g) =>
              g.rows.length === 0 ? 0 : Math.round(sum(g.rows, (r) => r.fee) / g.rows.length),
            csv: (g) =>
              g.rows.length === 0 ? 0 : Math.round(sum(g.rows, (r) => r.fee) / g.rows.length),
          },
          {
            label: 'Share',
            right: true,
            sortKey: 'share',
            cell: (g) => num(share(g.rows.length, total)),
            value: (g) => g.rows.length / Math.max(1, total),
            csv: (g) => share(g.rows.length, total),
          },
        ],
      });
    }

    case 'cancellation':
      return buildTable({
        rows: [...facts.filter((r) => r.status === 'Cancelled' || r.status === 'No-show')].sort(
          (a, b) => b.date.localeCompare(a.date),
        ),
        id: (r) => r.id,
        noun: 'cancellations',
        rowMeaning: 'One row per cancellation or no-show in the selected range.',
        cols: [
          {
            label: 'Date',
            sortKey: 'date',
            cell: (r) => text(fmtDate(r.date), r.time),
            value: (r) => r.date,
            csv: (r) => r.date,
          },
          {
            label: 'Patient',
            sortKey: 'patient',
            cell: (r) => text(r.patient, r.mrn, true),
            value: (r) => r.patient,
            csv: (r) => r.patient,
          },
          { label: 'Department', sortKey: 'dept', cell: (r) => text(r.dept), csv: (r) => r.dept },
          { label: 'Doctor', sortKey: 'doctor', cell: (r) => text(r.doctor), csv: (r) => r.doctor },
          {
            label: 'Status',
            sortKey: 'status',
            cell: (r) => badge(r.status),
            csv: (r) => r.status,
          },
          { label: 'Reason', sortKey: 'reason', cell: (r) => text(r.reason), csv: (r) => r.reason },
          {
            label: 'Fee',
            right: true,
            sortKey: 'fee',
            cell: (r) => num(money(r.fee)),
            value: (r) => r.fee,
            csv: (r) => r.fee,
          },
          {
            label: 'Refunded',
            right: true,
            sortKey: 'refund',
            cell: (r) => num(r.refund === 0 ? '—' : money(r.refund)),
            value: (r) => r.refund,
            csv: (r) => r.refund,
          },
        ],
      });

    case 'patient':
      return buildTable({
        rows: byPatient(facts),
        id: (g) => g.mrn,
        noun: 'patients',
        rowMeaning: 'One row per patient seen in the selected range.',
        cols: [
          {
            label: 'MRN',
            sortKey: 'mrn',
            cell: (g) => text(g.mrn),
            csv: (g) => g.mrn,
          },
          {
            label: 'Patient',
            sortKey: 'patient',
            cell: (g) => text(g.rows[0]?.patient ?? '—', g.rows[0]?.phone, true),
            value: (g) => g.rows[0]?.patient ?? '',
            csv: (g) => g.rows[0]?.patient ?? '',
          },
          {
            label: 'Visits',
            right: true,
            sortKey: 'visits',
            cell: (g) => num(String(g.rows.length)),
            value: (g) => g.rows.length,
            csv: (g) => g.rows.length,
          },
          {
            label: 'First visit',
            sortKey: 'first',
            cell: (g) =>
              text(fmtDate([...g.rows].sort((a, b) => a.date.localeCompare(b.date))[0]?.date)),
            value: (g) => [...g.rows].sort((a, b) => a.date.localeCompare(b.date))[0]?.date ?? '',
            csv: (g) => [...g.rows].sort((a, b) => a.date.localeCompare(b.date))[0]?.date ?? '',
          },
          {
            label: 'Last visit',
            sortKey: 'last',
            cell: (g) =>
              text(fmtDate([...g.rows].sort((a, b) => b.date.localeCompare(a.date))[0]?.date)),
            value: (g) => [...g.rows].sort((a, b) => b.date.localeCompare(a.date))[0]?.date ?? '',
            csv: (g) => [...g.rows].sort((a, b) => b.date.localeCompare(a.date))[0]?.date ?? '',
          },
          {
            label: 'Departments',
            sortKey: 'depts',
            cell: (g) => {
              const depts = [...new Set(g.rows.map((r) => r.dept))];
              return text(depts.length <= 2 ? depts.join(', ') : `${depts.length} departments`);
            },
            value: (g) => new Set(g.rows.map((r) => r.dept)).size,
            csv: (g) => [...new Set(g.rows.map((r) => r.dept))].join(' | '),
          },
          {
            label: 'Spend',
            right: true,
            sortKey: 'spend',
            cell: (g) => num(money(sum(g.rows, (r) => r.collected))),
            value: (g) => sum(g.rows, (r) => r.collected),
            csv: (g) => sum(g.rows, (r) => r.collected),
          },
        ],
      });

    case 'useractivity':
      return buildTable({
        rows: byActorDay(ctx.audit),
        id: (g) => g.key,
        noun: 'user-days',
        rowMeaning: 'One row per user per day, from the hospital audit trail.',
        cols: [
          {
            label: 'Date',
            sortKey: 'date',
            cell: (g) => text(fmtDate(g.date)),
            value: (g) => g.date,
            csv: (g) => g.date,
          },
          {
            label: 'User',
            sortKey: 'user',
            cell: (g) => text(g.actor, g.rows[0]?.actorRole, true),
            value: (g) => g.actor,
            csv: (g) => g.actor,
          },
          {
            label: 'Role',
            sortKey: 'role',
            cell: (g) => text(g.rows[0]?.actorRole ?? '—'),
            csv: (g) => g.rows[0]?.actorRole ?? '',
          },
          {
            label: 'Logins',
            right: true,
            sortKey: 'logins',
            cell: (g) => num(String(g.rows.filter((e) => e.action === 'Login').length)),
            value: (g) => g.rows.filter((e) => e.action === 'Login').length,
            csv: (g) => g.rows.filter((e) => e.action === 'Login').length,
          },
          {
            label: 'Actions',
            right: true,
            sortKey: 'actions',
            cell: (g) => num(String(g.rows.length)),
            value: (g) => g.rows.length,
            csv: (g) => g.rows.length,
          },
          {
            label: 'Last action',
            sortKey: 'lastaction',
            cell: (g) => {
              const last = [...g.rows].sort((a, b) => b.time.localeCompare(a.time))[0];
              return text(last?.summary ?? '—', last?.time);
            },
            value: (g) => [...g.rows].sort((a, b) => b.time.localeCompare(a.time))[0]?.time ?? '',
            csv: (g) => [...g.rows].sort((a, b) => b.time.localeCompare(a.time))[0]?.summary ?? '',
          },
          {
            label: 'IP',
            sortKey: 'ip',
            cell: (g) => text(g.rows[0]?.ip ?? '—'),
            csv: (g) => g.rows[0]?.ip ?? '',
          },
        ],
      });

    case 'bookingsource':
      return buildTable({
        rows: [...byDate(facts)].reverse(),
        id: (g) => g.date,
        noun: 'days',
        rowMeaning: 'One row per day, splitting bookings by channel.',
        cols: [
          {
            label: 'Date',
            sortKey: 'date',
            cell: (g) => text(fmtDate(g.date), undefined, true),
            value: (g) => g.date,
            csv: (g) => g.date,
          },
          {
            label: 'Online',
            right: true,
            sortKey: 'online',
            cell: (g) => num(String(outcomes(g.rows).online)),
            value: (g) => outcomes(g.rows).online,
            csv: (g) => outcomes(g.rows).online,
          },
          {
            label: 'Walk-in',
            right: true,
            sortKey: 'walkin',
            cell: (g) => num(String(outcomes(g.rows).walkIn)),
            value: (g) => outcomes(g.rows).walkIn,
            csv: (g) => outcomes(g.rows).walkIn,
          },
          {
            label: 'Total',
            right: true,
            sortKey: 'total',
            cell: (g) => num(String(g.rows.length)),
            value: (g) => g.rows.length,
            csv: (g) => g.rows.length,
          },
          {
            label: 'Online share',
            right: true,
            sortKey: 'share',
            cell: (g) => num(share(outcomes(g.rows).online, g.rows.length)),
            value: (g) => outcomes(g.rows).online / Math.max(1, g.rows.length),
            csv: (g) => share(outcomes(g.rows).online, g.rows.length),
          },
          {
            label: 'Online revenue',
            right: true,
            sortKey: 'onlinerev',
            cell: (g) => num(money(outcomes(g.rows).onlineCollected)),
            value: (g) => outcomes(g.rows).onlineCollected,
            csv: (g) => outcomes(g.rows).onlineCollected,
          },
        ],
      });

    case 'timerevenue': {
      const days = byDate(facts);
      const withPrevious = days.map((g, i) => ({ ...g, previous: days[i - 1] ?? null }));
      return buildTable({
        rows: [...withPrevious].reverse(),
        id: (g) => g.date,
        noun: 'days',
        rowMeaning: 'One row per day, with the change against the previous day.',
        cols: [
          {
            label: 'Date',
            sortKey: 'date',
            cell: (g) => text(fmtDate(g.date), undefined, true),
            value: (g) => g.date,
            csv: (g) => g.date,
          },
          {
            label: 'Appointments',
            right: true,
            sortKey: 'count',
            cell: (g) => num(String(g.rows.length)),
            value: (g) => g.rows.length,
            csv: (g) => g.rows.length,
          },
          {
            label: 'Collected',
            right: true,
            sortKey: 'collected',
            cell: (g) => num(money(outcomes(g.rows).collected)),
            value: (g) => outcomes(g.rows).collected,
            csv: (g) => outcomes(g.rows).collected,
          },
          {
            label: 'Avg / appointment',
            right: true,
            sortKey: 'avg',
            cell: (g) =>
              num(
                g.rows.length === 0
                  ? '—'
                  : money(Math.round(outcomes(g.rows).collected / g.rows.length)),
              ),
            value: (g) =>
              g.rows.length === 0 ? 0 : Math.round(outcomes(g.rows).collected / g.rows.length),
            csv: (g) =>
              g.rows.length === 0 ? 0 : Math.round(outcomes(g.rows).collected / g.rows.length),
          },
          {
            label: 'vs previous day',
            right: true,
            sortKey: 'delta',
            cell: (g) => {
              if (!g.previous) return num('—');
              const now = outcomes(g.rows).collected;
              const before = outcomes(g.previous.rows).collected;
              if (before === 0) return num('—');
              const delta = ((now - before) / before) * 100;
              return num(`${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`, money(now - before));
            },
            value: (g) => {
              if (!g.previous) return null;
              const now = outcomes(g.rows).collected;
              const before = outcomes(g.previous.rows).collected;
              return before === 0 ? null : ((now - before) / before) * 100;
            },
            csv: (g) => {
              if (!g.previous) return '';
              const now = outcomes(g.rows).collected;
              const before = outcomes(g.previous.rows).collected;
              return before === 0 ? '' : `${(((now - before) / before) * 100).toFixed(1)}%`;
            },
          },
        ],
      });
    }

    default:
      return buildTable({
        rows: facts,
        id: (r) => r.id,
        noun: 'rows',
        rowMeaning: 'One row per appointment.',
        cols: [
          {
            label: 'Date',
            sortKey: 'date',
            cell: (r) => text(fmtDate(r.date)),
            value: (r) => r.date,
            csv: (r) => r.date,
          },
          {
            label: 'Patient',
            sortKey: 'patient',
            cell: (r) => text(r.patient),
            csv: (r) => r.patient,
          },
          {
            label: 'Status',
            sortKey: 'status',
            cell: (r) => badge(r.status),
            csv: (r) => r.status,
          },
        ],
      });
  }
}

/**
 * The four summary tiles — derived from **the same filtered rows** the table
 * shows, which is what makes the filters demonstrably live (audit HA-13).
 */
export function buildReportKpis(reportId: string, ctx: ReportContext): readonly ReportKpi[] {
  const facts = ctx.facts;
  const o = outcomes(facts);
  const days = byDate(facts).length;
  const rangeCopy = days === 0 ? 'no matching days' : `over ${days} ${days === 1 ? 'day' : 'days'}`;

  switch (reportId) {
    case 'appointment':
      return [
        kpi('calendar-check', 'Total Appointments', String(o.total), rangeCopy, B),
        kpi('circle-check', 'Completed', String(o.completed), share(o.completed, o.total), G),
        kpi('calendar-x', 'Cancelled', String(o.cancelled), share(o.cancelled, o.total), Y),
        kpi('user-x', 'No-shows', String(o.noShow), share(o.noShow, o.total), D),
      ];

    case 'booking': {
      const perDay = days === 0 ? 0 : Math.round(o.total / days);
      return [
        kpi('book-open', 'Total Bookings', String(o.total), 'online + walk-in', B),
        kpi('smartphone', 'Online', String(o.online), share(o.online, o.total), G),
        kpi('footprints', 'Walk-in', String(o.walkIn), share(o.walkIn, o.total), Y),
        kpi('calendar-days', 'Avg / day', String(perDay), rangeCopy, P),
      ];
    }

    case 'revenue': {
      const net = o.collected - o.refunds;
      const avg = o.total === 0 ? 0 : Math.round(o.collected / o.total);
      return [
        kpi('indian-rupee', 'Net Collected', moneyShort(net), `${money(o.refunds)} refunded`, G),
        kpi('smartphone', 'Online (prepaid)', moneyShort(o.onlineCollected), 'via Medibook', B),
        kpi('banknote', 'Walk-in (desk)', moneyShort(o.walkInCollected), 'collected at desk', Y),
        kpi('calendar-days', 'Avg / appointment', money(avg), `${o.total} appointments`, P),
      ];
    }

    case 'payment': {
      const paid = facts.filter((r) => r.collected > 0);
      const cash = sum(
        paid.filter((r) => r.mode === 'Cash'),
        (r) => r.collected,
      );
      const card = sum(
        paid.filter((r) => r.mode === 'UPI' || r.mode === 'Card'),
        (r) => r.collected,
      );
      const online = sum(
        paid.filter((r) => r.mode === 'Online'),
        (r) => r.collected,
      );
      return [
        kpi('wallet', 'Payments Recorded', String(paid.length), rangeCopy, B),
        kpi('banknote', 'Cash', moneyShort(cash), 'at the desk', G),
        kpi('credit-card', 'UPI / Card', moneyShort(card), 'at the desk', Y),
        kpi('smartphone', 'Prepaid Online', moneyShort(online), 'via Medibook', P),
      ];
    }

    case 'refund': {
      const refunded = facts.filter((r) => r.refund > 0);
      const avg = refunded.length === 0 ? 0 : Math.round(o.refunds / refunded.length);
      return [
        kpi('rotate-ccw', 'Refunds Processed', String(refunded.length), rangeCopy, B),
        kpi('indian-rupee', 'Refunded Amount', money(o.refunds), 'slab-based', Y),
        kpi('calendar-x', 'Eligible Cancellations', String(o.cancelled), 'in range', P),
        kpi('percent', 'Avg Refund', money(avg), 'per refund', G),
      ];
    }

    case 'settlement': {
      const s = ctx.settlements;
      const net = sum(s, (x) => x.net);
      const received = sum(
        s.filter((x) => x.status === 'Received'),
        (x) => x.net,
      );
      const overdue = s.filter((x) => x.status === 'Overdue');
      return [
        kpi('wallet', 'Total Net Payable', moneyShort(net), `${s.length} statements`, B),
        kpi('circle-check', 'Received', moneyShort(received), 'credited to account', G),
        kpi(
          'triangle-alert',
          'Overdue',
          moneyShort(sum(overdue, (x) => x.net)),
          `${overdue.length} pending`,
          D,
        ),
        kpi(
          'indian-rupee',
          'Gross Collected',
          moneyShort(sum(s, (x) => x.gross)),
          'online bookings',
          P,
        ),
      ];
    }

    case 'commission': {
      const online = facts.filter((r) => r.commission > 0);
      const gross = sum(online, (r) => r.collected);
      return [
        kpi('percent', 'Commission', money(o.commission), `${online.length} online bookings`, Y),
        kpi('indian-rupee', 'Online Gross', moneyShort(gross), 'booking fees', B),
        kpi('wallet', 'Net to Hospital', moneyShort(gross - o.commission), 'after commission', G),
        kpi('smartphone', 'Walk-in Commission', money(0), 'hospital keeps 100%', P),
      ];
    }

    case 'doctor': {
      const doctors = byDoctor(facts);
      const rated = doctors
        .map((g) => ({ doctor: g.doctor, rating: avgRating(g.rows) }))
        .filter((x): x is { doctor: string; rating: number } => x.rating != null)
        .sort((a, b) => b.rating - a.rating);
      const overall = avgRating(facts);
      const avgLoad = doctors.length === 0 ? 0 : Math.round(o.total / doctors.length);
      return [
        kpi('stethoscope', 'Doctors in Range', String(doctors.length), 'with appointments', B),
        kpi('calendar-check', 'Avg Appts / Doctor', String(avgLoad), rangeCopy, G),
        kpi(
          'star',
          'Top Rated',
          rated[0]?.doctor ?? '—',
          rated[0] ? `${rated[0].rating.toFixed(1)} rating` : 'no ratings yet',
          Y,
        ),
        kpi(
          'smile',
          'Avg Rating',
          overall == null ? '—' : `${overall.toFixed(1)} / 5`,
          'across doctors',
          P,
        ),
      ];
    }

    case 'department': {
      const depts = byDept(facts);
      const busiest = [...depts].sort((a, b) => b.rows.length - a.rows.length)[0];
      const richest = [...depts].sort(
        (a, b) => outcomes(b.rows).collected - outcomes(a.rows).collected,
      )[0];
      const avgFee = o.total === 0 ? 0 : Math.round(sum(facts, (r) => r.fee) / o.total);
      return [
        kpi('layout-grid', 'Departments', String(depts.length), 'with appointments', B),
        kpi(
          'trending-up',
          'Busiest',
          busiest?.dept ?? '—',
          busiest ? `${busiest.rows.length} appointments` : rangeCopy,
          G,
        ),
        kpi(
          'indian-rupee',
          'Top Revenue',
          richest?.dept ?? '—',
          richest ? moneyShort(outcomes(richest.rows).collected) : rangeCopy,
          Y,
        ),
        kpi('indian-rupee', 'Avg Fee', money(avgFee), 'per consultation', P),
      ];
    }

    case 'cancellation':
      return [
        kpi('calendar-x', 'Cancellations', String(o.cancelled), rangeCopy, Y),
        kpi('user-x', 'No-shows', String(o.noShow), rangeCopy, D),
        kpi('percent', 'Cancellation Rate', share(o.cancelled, o.total), 'of filtered rows', B),
        kpi('percent', 'No-show Rate', share(o.noShow, o.total), 'of filtered rows', P),
      ];

    case 'patient': {
      const patients = byPatient(facts);
      const returning = patients.filter((g) => g.rows.length > 1).length;
      const avgVisits = patients.length === 0 ? 0 : o.total / patients.length;
      return [
        kpi('users', 'Patients Seen', String(patients.length), rangeCopy, B),
        kpi('user-plus', 'Single-visit', String(patients.length - returning), 'one visit only', G),
        kpi('repeat', 'Returning', share(returning, patients.length), 'more than one visit', Y),
        kpi('calendar-check', 'Avg Visits', avgVisits.toFixed(1), 'per patient', P),
      ];
    }

    case 'useractivity': {
      const entries = ctx.audit;
      const actors = [...groupBy(entries, (e) => e.actor).entries()].sort(
        (a, b) => b[1].length - a[1].length,
      );
      const logins = entries.filter((e) => e.action === 'Login').length;
      return [
        kpi('users', 'Active Users', String(actors.length), 'with logged activity', B),
        kpi('log-in', 'Logins', String(logins), rangeCopy, G),
        kpi('activity', 'Actions Logged', String(entries.length), 'across modules', Y),
        kpi(
          'user-check',
          'Most Active',
          actors[0]?.[0] ?? '—',
          actors[0] ? `${actors[0][1].length} actions` : 'no activity in range',
          P,
        ),
      ];
    }

    case 'bookingsource': {
      const onlineRevenue = o.onlineCollected;
      const bestDay = [...byDate(facts)].sort(
        (a, b) => outcomes(b.rows).online - outcomes(a.rows).online,
      )[0];
      return [
        kpi('smartphone', 'Online', share(o.online, o.total), `${o.online} bookings`, B),
        kpi('footprints', 'Walk-in', share(o.walkIn, o.total), `${o.walkIn} bookings`, Y),
        kpi('indian-rupee', 'Online Revenue', moneyShort(onlineRevenue), 'prepaid via Medibook', G),
        kpi(
          'trending-up',
          'Best Online Day',
          bestDay ? fmtDate(bestDay.date) : '—',
          bestDay ? `${outcomes(bestDay.rows).online} online bookings` : rangeCopy,
          P,
        ),
      ];
    }

    case 'timerevenue': {
      const dayGroups = byDate(facts);
      const peak = [...dayGroups].sort(
        (a, b) => outcomes(b.rows).collected - outcomes(a.rows).collected,
      )[0];
      const perDay = dayGroups.length === 0 ? 0 : Math.round(o.collected / dayGroups.length);
      const firstHalf = dayGroups.slice(0, Math.floor(dayGroups.length / 2));
      const secondHalf = dayGroups.slice(Math.floor(dayGroups.length / 2));
      const firstTotal = sum(firstHalf, (g) => outcomes(g.rows).collected);
      const secondTotal = sum(secondHalf, (g) => outcomes(g.rows).collected);
      const trend = firstTotal === 0 ? null : ((secondTotal - firstTotal) / firstTotal) * 100;
      return [
        kpi('indian-rupee', 'Collected (range)', moneyShort(o.collected), rangeCopy, G),
        kpi(
          'calendar-days',
          'Peak Day',
          peak ? fmtDate(peak.date) : '—',
          peak ? moneyShort(outcomes(peak.rows).collected) : rangeCopy,
          B,
        ),
        kpi(
          'trending-up',
          'Second half vs first',
          trend == null ? '—' : `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`,
          'within the filtered range',
          Y,
        ),
        kpi('clock', 'Avg / day', money(perDay), `${dayGroups.length} days with activity`, P),
      ];
    }

    default:
      return [];
  }
}

/**
 * Catalogue order first (it is the hospital's own ordering), then any value
 * present in the data that the catalogue does not list — a retired doctor
 * still owns historical rows, and a filter that dropped them could never
 * match those rows. Without a catalogue, the data's own values, sorted.
 */
function mergeOptions(
  preferred: readonly string[],
  present: readonly string[],
  hasCatalog: boolean,
): readonly string[] {
  const inData = new Set(present);
  if (!hasCatalog) return [...inData].sort();
  const ordered = preferred.filter((name) => inData.has(name));
  const known = new Set(ordered);
  const extra = [...inData].filter((name) => !known.has(name)).sort();
  return [...ordered, ...extra];
}

/** Filter options a report's toolbar should offer, derived from the facts. */
export interface ReportFilterOptions {
  readonly departments: readonly string[];
  readonly doctors: readonly string[];
  readonly statuses: readonly string[];
  readonly sources: readonly string[];
  readonly modes: readonly string[];
  readonly users: readonly string[];
}

/**
 * The hospital's own departments and doctors, as the Doctors & Departments
 * catalogue reports them (`catalog.selectors.ts`). Passing them in is what
 * keeps the report toolbar honest: add a doctor to the catalogue and the
 * doctor filter offers them on the next render (audit 2.6.3).
 */
export interface ReportCatalog {
  readonly departments: readonly string[];
  readonly doctors: readonly string[];
}

/**
 * Options for a report's toolbar. Departments and doctors come from the
 * catalogue when one is supplied; otherwise — and for any historical value the
 * catalogue no longer lists — they fall back to the values actually present in
 * the facts, so a filter can never offer a value that matches nothing and
 * never misses a value that does.
 */
export function filterOptions(
  reportId: string,
  facts: readonly ReportFact[],
  audit: readonly AuditEntry[],
  catalog?: ReportCatalog,
): ReportFilterOptions {
  const departments = mergeOptions(
    catalog?.departments ?? [],
    facts.map((r) => r.dept),
    catalog !== undefined,
  );
  const doctors = mergeOptions(
    catalog?.doctors ?? [],
    facts.map((r) => r.doctor),
    catalog !== undefined,
  );
  return {
    departments: [ALL_DEPARTMENTS, ...departments],
    doctors: [ALL_DOCTORS, ...doctors],
    statuses: statusOptionsFor(reportId),
    sources: [ALL_SOURCES, 'Online', 'Walk-in'],
    modes: [ALL_MODES, 'Cash', 'UPI', 'Card', 'Online', 'Unpaid'],
    users:
      reportId === 'useractivity'
        ? [ALL_USERS, ...[...new Set(audit.map((e) => e.actor))].sort()]
        : [ALL_USERS, ...[...new Set(facts.map((r) => r.bookedBy))].sort()],
  };
}
