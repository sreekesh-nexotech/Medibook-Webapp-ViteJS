import type { IconName } from '@/shared/ui/icon-registry';

import type { ReportDefinition } from '@/features/reports/domain/entities/reports.entities';

import type { ReportCategory } from './reports.data';

/**
 * The design's presentation of each backend report — category tab, icon,
 * one-line brief and the row noun for the pager. The server owns everything
 * else (title, filters, columns, KPIs); this only dresses it. Keyed by the
 * backend report code (`reports/services/specs.py`).
 */
interface ReportDesign {
  readonly cat: ReportCategory;
  readonly icon: IconName;
  readonly brief: string;
  readonly noun: string;
}

const DESIGN: Readonly<Record<string, ReportDesign>> = {
  appointment: {
    cat: 'Operations',
    icon: 'calendar-days',
    brief: 'Track appointments across doctors and departments.',
    noun: 'appointments',
  },
  booking: {
    cat: 'Operations',
    icon: 'book-open',
    brief: 'Track bookings by booking date and appointment date.',
    noun: 'bookings',
  },
  revenue: {
    cat: 'Finance',
    icon: 'indian-rupee',
    brief: 'Track hospital earnings, one row per appointment date.',
    noun: 'days',
  },
  payment: {
    cat: 'Finance',
    icon: 'wallet',
    brief: 'Track payments received at the desk and online.',
    noun: 'payments',
  },
  refund: {
    cat: 'Finance',
    icon: 'rotate-ccw',
    brief: 'Track refunds and why they were made.',
    noun: 'refunds',
  },
  settlement: {
    cat: 'Finance',
    icon: 'scale',
    brief: 'Track payouts received from Medibook, per settlement period.',
    noun: 'periods',
  },
  commission: {
    cat: 'Finance',
    icon: 'percent',
    brief: 'Track commission deducted on online bookings.',
    noun: 'bookings',
  },
  doctor_performance: {
    cat: 'People',
    icon: 'stethoscope',
    brief: 'Track per-doctor bookings, completions and revenue.',
    noun: 'doctors',
  },
  department: {
    cat: 'People',
    icon: 'layout-grid',
    brief: 'Track department-level bookings and revenue.',
    noun: 'departments',
  },
  cancellation_no_show: {
    cat: 'Operations',
    icon: 'calendar-x',
    brief: 'Track cancellations and no-shows, with the reason.',
    noun: 'bookings',
  },
  patient: {
    cat: 'People',
    icon: 'users',
    brief: 'Track patient visits and bookings.',
    noun: 'patients',
  },
  user_activity: {
    cat: 'People',
    icon: 'activity',
    brief: "Track patients' last app activity and their bookings.",
    noun: 'patients',
  },
  booking_source: {
    cat: 'Operations',
    icon: 'git-branch',
    brief: 'Track the app vs walk-in mix.',
    noun: 'bookings',
  },
  time_based_revenue: {
    cat: 'Finance',
    icon: 'trending-up',
    brief: 'Track revenue day by day across the range.',
    noun: 'days',
  },
};

/** A report the server added that the design does not know yet. */
const FALLBACK_DESIGN: ReportDesign = {
  cat: 'Operations',
  icon: 'file-text',
  brief: '',
  noun: 'rows',
};

/** A server report dressed for the picker and header. */
export interface ReportCatalogItem extends ReportDesign {
  readonly code: string;
  readonly title: string;
  readonly definition: ReportDefinition;
}

export function toCatalogItem(definition: ReportDefinition): ReportCatalogItem {
  return {
    ...(DESIGN[definition.code] ?? FALLBACK_DESIGN),
    code: definition.code,
    title: definition.title,
    definition,
  };
}
