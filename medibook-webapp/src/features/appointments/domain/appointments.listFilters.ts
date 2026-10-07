import type {
  ApptPaymentStatus,
  ApptSource,
  ApptStatus,
} from '@/features/appointments/domain/entities/appointments.entities';

/**
 * How the desk list's tabs and status filter translate into the backend's
 * allowlisted filters (`GET /hospital/appointments?status&source&payment_status`).
 * Pure rules, no React, no I/O.
 */

/** The server-side part of a tab or a status choice. */
export interface ServerFilter {
  readonly statuses: readonly ApptStatus[];
  readonly source: ApptSource | null;
  readonly paymentStatus: ApptPaymentStatus | null;
}

export const APPOINTMENT_TABS = [
  'All',
  'Online',
  'Walk-in',
  'Pending Payment',
  'In Queue',
  'Needs Approval',
] as const;

export type AppointmentTab = (typeof APPOINTMENT_TABS)[number];

/** URL slugs for the tabs (`?tab=`), so other screens can deep-link a filtered list. */
export const TAB_SLUGS: Readonly<Record<AppointmentTab, string>> = {
  All: 'all',
  Online: 'online',
  'Walk-in': 'walk-in',
  'Pending Payment': 'pending-payment',
  'In Queue': 'in-queue',
  'Needs Approval': 'needs-approval',
};

/** The tab a `?tab=` slug names; `All` for anything unknown. */
export function tabFromSlug(slug: string | null): AppointmentTab {
  return APPOINTMENT_TABS.find((t) => TAB_SLUGS[t] === slug) ?? 'All';
}

/** Tabs that show a count next to their name. */
export type CountedTab = Exclude<AppointmentTab, 'All'>;

const ANY: ServerFilter = { statuses: [], source: null, paymentStatus: null };

/** Statuses of a walk-in that is still on (nothing more is collected after these end). */
const LIVE_WALK_IN: readonly ApptStatus[] = ['scheduled', 'checked_in', 'in_consultation'];

export const TAB_FILTERS: Readonly<Record<AppointmentTab, ServerFilter>> = {
  All: ANY,
  Online: { ...ANY, source: 'online' },
  'Walk-in': { ...ANY, source: 'walk_in' },
  // Walk-ins still owing their fee; online bookings are prepaid (Q89).
  'Pending Payment': { statuses: LIVE_WALK_IN, source: 'walk_in', paymentStatus: 'unpaid' },
  'In Queue': { ...ANY, statuses: ['checked_in', 'in_consultation'] },
  'Needs Approval': { ...ANY, statuses: ['pending_approval'] },
};

/** The status filter's options, in desk order, with the statuses each one means. */
export const STATUS_CHOICES = {
  'Awaiting approval': ['pending_approval'],
  Scheduled: ['scheduled'],
  'In Queue': ['checked_in', 'in_consultation'],
  Completed: ['completed'],
  Cancelled: ['cancelled'],
  'No-show': ['no_show'],
  'Awaiting payment': ['pending_payment'],
} as const satisfies Readonly<Record<string, readonly ApptStatus[]>>;

export type StatusChoice = keyof typeof STATUS_CHOICES;

export const STATUS_CHOICE_LABELS = Object.keys(STATUS_CHOICES) as readonly StatusChoice[];

export function isStatusChoice(value: string): value is StatusChoice {
  return (STATUS_CHOICE_LABELS as readonly string[]).includes(value);
}

export function isAppointmentTab(value: string): value is AppointmentTab {
  return (APPOINTMENT_TABS as readonly string[]).includes(value);
}

/**
 * The tab and the status filter together, as one server filter — or `null`
 * when they cannot both hold (e.g. "Needs Approval" with "Completed"), in
 * which case nothing matches and no request is needed.
 */
export function combineFilters(
  tab: AppointmentTab,
  status: StatusChoice | null,
): ServerFilter | null {
  const fromTab = TAB_FILTERS[tab];
  if (!status) return fromTab;
  const chosen: readonly ApptStatus[] = STATUS_CHOICES[status];
  if (fromTab.statuses.length === 0) return { ...fromTab, statuses: chosen };
  const both = fromTab.statuses.filter((s) => chosen.includes(s));
  return both.length === 0 ? null : { ...fromTab, statuses: both };
}

/** Each counted tab's own filter, for the per-tab counts. */
export const TAB_COUNT_FILTERS: Readonly<Record<CountedTab, ServerFilter>> = {
  Online: TAB_FILTERS.Online,
  'Walk-in': TAB_FILTERS['Walk-in'],
  'Pending Payment': TAB_FILTERS['Pending Payment'],
  'In Queue': TAB_FILTERS['In Queue'],
  'Needs Approval': TAB_FILTERS['Needs Approval'],
};
