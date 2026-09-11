import type { IconName } from '@/shared/ui/icon-registry';

import type { ReportFilter } from '@/features/reports/application/store/reports.types';

/**
 * The report catalogue — the fourteen reports, their categories and the filter
 * controls each one offers. Ported from the design source (`Admin.jsx` —
 * `REPORTS`, `REPORT_CATS`, `CAT_STYLE`), with the KPI builder removed: tiles
 * and tables are now derived from the filtered fact table in
 * `application/store/reports.logic.ts` (audit HA-13), not hardcoded here.
 *
 * A report's `filters` list is binding in both directions: the toolbar renders
 * exactly these controls, and `filterFacts` applies exactly these filters. So
 * a report can never show a control that does nothing, and never filter by
 * something the user cannot see.
 */

export type ReportCategory = 'Operations' | 'Finance' | 'People';

export interface ReportDef {
  readonly id: string;
  readonly name: string;
  readonly brief: string;
  readonly icon: IconName;
  readonly cat: ReportCategory;
  readonly filters: readonly ReportFilter[];
}

export const REPORTS: readonly ReportDef[] = [
  {
    id: 'appointment',
    name: 'Appointment Report',
    brief: 'Track appointments across doctors and departments.',
    icon: 'calendar-days',
    cat: 'Operations',
    filters: ['date', 'dept', 'doctor', 'status'],
  },
  {
    id: 'booking',
    name: 'Booking Report',
    brief: 'Track bookings by channel and slot.',
    icon: 'book-open',
    cat: 'Operations',
    filters: ['date', 'dept', 'doctor', 'source', 'user'],
  },
  {
    id: 'revenue',
    name: 'Revenue Report',
    brief: 'Track hospital earnings over time.',
    icon: 'indian-rupee',
    cat: 'Finance',
    filters: ['date', 'dept', 'doctor'],
  },
  {
    id: 'payment',
    name: 'Payment Report',
    brief: 'Track payments received at the desk and online.',
    icon: 'wallet',
    cat: 'Finance',
    filters: ['date', 'dept', 'mode', 'source'],
  },
  {
    id: 'refund',
    name: 'Refund Report',
    brief: 'Track refunds processed by Medibook.',
    icon: 'rotate-ccw',
    cat: 'Finance',
    filters: ['date', 'dept', 'doctor'],
  },
  {
    id: 'settlement',
    name: 'Settlement Report',
    brief: 'Track payouts received from Medibook.',
    icon: 'scale',
    cat: 'Finance',
    filters: ['date', 'status'],
  },
  {
    id: 'commission',
    name: 'Commission Report',
    brief: 'Track commission deducted on online bookings.',
    icon: 'percent',
    cat: 'Finance',
    filters: ['date', 'dept'],
  },
  {
    id: 'doctor',
    name: 'Doctor Performance Report',
    brief: 'Track per-doctor load and ratings.',
    icon: 'stethoscope',
    cat: 'People',
    filters: ['date', 'dept', 'doctor'],
  },
  {
    id: 'department',
    name: 'Department Report',
    brief: 'Track department-level performance.',
    icon: 'layout-grid',
    cat: 'People',
    filters: ['date', 'dept', 'status'],
  },
  {
    id: 'cancellation',
    name: 'Cancellation / No-show Report',
    brief: 'Track cancellations and no-shows.',
    icon: 'calendar-x',
    cat: 'Operations',
    filters: ['date', 'dept', 'doctor', 'status'],
  },
  {
    id: 'patient',
    name: 'Patient Report',
    brief: 'Track patient registrations and visits.',
    icon: 'users',
    cat: 'People',
    filters: ['date', 'dept', 'doctor'],
  },
  {
    id: 'useractivity',
    name: 'User Activity Report',
    brief: 'Track staff logins and actions.',
    icon: 'activity',
    cat: 'People',
    filters: ['date', 'user'],
  },
  {
    id: 'bookingsource',
    name: 'Booking Source Report',
    brief: 'Track online vs walk-in mix.',
    icon: 'git-branch',
    cat: 'Operations',
    filters: ['date', 'dept', 'source'],
  },
  {
    id: 'timerevenue',
    name: 'Time-based Revenue Report',
    brief: 'Track revenue trends across the range.',
    icon: 'trending-up',
    cat: 'Finance',
    filters: ['date', 'dept'],
  },
];

export const REPORT_CATS: readonly string[] = ['All', 'Operations', 'Finance', 'People'];

/**
 * Design `CAT_STYLE` translated to token classes for the icon box
 * (`bg` + `c`): Operations → blue, Finance → g-600, People → p-500.
 */
export const CAT_ICON_CLASS: Record<ReportCategory, string> = {
  Operations: 'bg-blue-soft-bg text-blue',
  Finance: 'bg-g-100 text-g-600',
  People: 'bg-p-100 text-p-500',
};

/** Rows per page in every report table — the rhythm the payments table uses. */
export const REPORT_PAGE_SIZE = 10;
