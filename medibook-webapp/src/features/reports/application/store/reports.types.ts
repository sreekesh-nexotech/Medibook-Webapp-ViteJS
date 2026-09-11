/**
 * Reporting view-model types — audit HA-13 (§2.4): "Fourteen report screens
 * exist, but each shows four fixed tiles with no data table, and the filters
 * change nothing."
 *
 * The fix is one **fact table** (`ReportFact` — one row per appointment, with
 * its money, payment, refund and rating attached) that every report is derived
 * from, plus a **pre-rendered table** shape so the screen can draw any of the
 * fourteen reports without knowing what a row means.
 *
 * Money is an integer in whole rupees, the unit `money()` formats
 * (CANONICAL_MASTER_DATA §8). Dates are real ISO `yyyy-mm-dd` values.
 */

import type { CsvCell } from '@/shared/lib/download';
import type { SortValue } from '@/shared/hooks/useSort';
import type { IconName } from '@/shared/ui/icon-registry';

/** Which filter controls a report's toolbar shows. */
export type ReportFilter = 'date' | 'dept' | 'doctor' | 'status' | 'source' | 'mode' | 'user';

/** The toolbar's current state. Empty / "All …" values mean "do not filter". */
export interface ReportFilterState {
  /** ISO `yyyy-mm-dd`, inclusive. Empty means open-ended. */
  readonly from: string;
  readonly to: string;
  readonly dept: string;
  readonly doctor: string;
  readonly status: string;
  readonly source: string;
  readonly mode: string;
  readonly user: string;
}

export type AppointmentSource = 'Online' | 'Walk-in';

export type FactStatus = 'Scheduled' | 'In Queue' | 'Completed' | 'Cancelled' | 'No-show';

export type PaymentMode = 'Cash' | 'UPI' | 'Card' | 'Online' | 'Unpaid';

/**
 * One appointment, with everything the fourteen reports need to count, sum or
 * group by. This is the only seed the reports read.
 */
export interface ReportFact {
  readonly id: string;
  /** Canonical booking reference, `MB-2026-000124`. */
  readonly bookingRef: string;
  /** Appointment date, ISO. */
  readonly date: string;
  /** Date the booking was made, ISO (earlier than `date` for app bookings). */
  readonly bookedOn: string;
  /** Slot label, e.g. "9:30 am". */
  readonly time: string;
  readonly patient: string;
  readonly mrn: string;
  readonly phone: string;
  readonly dept: string;
  readonly doctor: string;
  readonly source: AppointmentSource;
  readonly status: FactStatus;
  /** Consultation fee charged, whole rupees. */
  readonly fee: number;
  /** Amount actually collected, whole rupees (0 when unpaid). */
  readonly collected: number;
  readonly mode: PaymentMode;
  /** Refund paid back on a cancellation, whole rupees (0 when none). */
  readonly refund: number;
  /** Platform commission on an online booking, whole rupees (0 for walk-ins). */
  readonly commission: number;
  /** Financial-year receipt series, `MB/R/2026-27/000123`; null when unpaid. */
  readonly receipt: string | null;
  /** Queue token, `T-001`; null when none was issued. */
  readonly token: string | null;
  /** Patient rating out of 5 for a completed visit; null otherwise. */
  readonly rating: number | null;
  /** Who booked it — a staff user, or "Patient app" for an app booking. */
  readonly bookedBy: string;
  /** Cancellation / no-show reason; empty when not applicable. */
  readonly reason: string;
}

/** One KPI tile. Shape is assignable to `StatCardData`. */
export interface ReportKpi {
  readonly icon: IconName;
  readonly label: string;
  readonly value: string;
  readonly sub: string;
  readonly iconClass: string;
  readonly valueClass: string;
  readonly subClass?: string;
}

/**
 * A table cell, already rendered down to what the screen must draw. Keeping
 * the cell dumb is what lets one table component serve all fourteen reports.
 */
export type ReportCell =
  | {
      readonly kind: 'text';
      readonly text: string;
      readonly sub?: string;
      readonly strong?: boolean;
    }
  | { readonly kind: 'num'; readonly text: string; readonly sub?: string }
  | { readonly kind: 'badge'; readonly status: string; readonly label?: string };

/** One table row: the cells to draw, the values to sort by, the CSV line. */
export interface ReportTableRow {
  readonly id: string;
  readonly cells: readonly ReportCell[];
  /** Column label → sortable value, for `useSort`. */
  readonly sortValues: Readonly<Record<string, SortValue>>;
  readonly csv: readonly CsvCell[];
}

/** Everything needed to draw one report's table. */
export interface ReportTable {
  readonly columns: readonly string[];
  /** Columns to right-align (numbers and money). */
  readonly rightCols: readonly string[];
  /** Column label → sort key; a column without an entry is not sortable. */
  readonly sortKeys: Readonly<Record<string, string>>;
  readonly rows: readonly ReportTableRow[];
  /** Row noun for the pager, e.g. "appointments". */
  readonly noun: string;
  /** One line describing what a row of this report is. */
  readonly rowMeaning: string;
}
