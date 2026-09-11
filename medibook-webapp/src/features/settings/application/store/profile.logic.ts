/**
 * Pure hospital-profile rules: what a holiday closes, and whether a published
 * banner is live. No React and no store, so slot generation, the booking
 * screens and this feature's own UI can all ask the same questions.
 *
 * The holiday helpers are the ones slot generation must respect (audit HA-03):
 *
 * ```ts
 * import { useHospitalProfileStore, selectHolidays } from '…/profile.store';
 * import { isClosedOn } from '…/profile.logic';
 *
 * const holidays = useHospitalProfileStore(selectHolidays);
 * const closed = isClosedOn(holidays, { date: '2026-06-17', department: 'Cardiology' });
 * ```
 */

import type { BannerState, HospitalBranch, HospitalHoliday, PatientBanner } from './profile.types';

/** What to test against the calendar. Omit a field to ignore that scope. */
export interface ClosureQuery {
  /** ISO `yyyy-mm-dd`. */
  readonly date: string;
  /** Branch being booked, if the caller works per branch. */
  readonly branchId?: string;
  /** Department being booked, e.g. "Cardiology". */
  readonly department?: string;
}

/** True when `holiday` covers `date` (both ends inclusive). */
export function holidayCoversDate(holiday: HospitalHoliday, date: string): boolean {
  return date >= holiday.from && date <= holiday.to;
}

/**
 * Every closure that applies to the queried day and scope. A whole-hospital
 * closure always applies; a branch or department closure applies only when
 * the query names that branch/department (or names neither, in which case the
 * caller is asking "is anything closed today?").
 */
export function closuresOn(
  holidays: readonly HospitalHoliday[],
  query: ClosureQuery,
): readonly HospitalHoliday[] {
  return holidays.filter((h) => {
    if (!holidayCoversDate(h, query.date)) return false;
    if (h.scope === 'Whole hospital') return true;
    if (h.scope === 'Branch') return query.branchId == null || query.branchId === h.scopeRef;
    return query.department == null || query.department === h.scopeRef;
  });
}

/** True when no slots may be generated for the queried day and scope. */
export function isClosedOn(holidays: readonly HospitalHoliday[], query: ClosureQuery): boolean {
  return closuresOn(holidays, query).length > 0;
}

/** Closed ISO dates inside `[from, to]` for the queried scope, ascending. */
export function closedDatesBetween(
  holidays: readonly HospitalHoliday[],
  from: string,
  to: string,
  scope: Omit<ClosureQuery, 'date'> = {},
): readonly string[] {
  const out = new Set<string>();
  for (const h of holidays) {
    for (const date of datesOf(h)) {
      if (date < from || date > to) continue;
      if (isClosedOn([h], { ...scope, date })) out.add(date);
    }
  }
  return [...out].sort();
}

/** Every ISO date a holiday covers (capped, so a typo cannot loop forever). */
const MAX_HOLIDAY_SPAN_DAYS = 90;

export function datesOf(holiday: HospitalHoliday): readonly string[] {
  const out: string[] = [];
  const [y, m, d] = holiday.from.split('-').map(Number);
  const cursor = new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
  for (let i = 0; i < MAX_HOLIDAY_SPAN_DAYS; i += 1) {
    const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(
      cursor.getDate(),
    ).padStart(2, '0')}`;
    if (iso > holiday.to) break;
    out.push(iso);
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/** How many days a closure spans (1 for a single day). */
export function holidayDayCount(holiday: HospitalHoliday): number {
  return datesOf(holiday).length;
}

/** "Whole hospital" / a branch name / a department name, for display. */
export function holidayScopeCopy(
  holiday: HospitalHoliday,
  branches: readonly HospitalBranch[],
): string {
  if (holiday.scope === 'Whole hospital') return 'Whole hospital';
  if (holiday.scope === 'Branch') {
    return branches.find((b) => b.id === holiday.scopeRef)?.name ?? 'Unknown branch';
  }
  return holiday.scopeRef || 'Unknown department';
}

/** Publication state of a banner on `today` (ISO). */
export function bannerStateOn(banner: PatientBanner, today: string): BannerState {
  if (!banner.active) return 'Paused';
  if (banner.to && banner.to < today) return 'Expired';
  if (banner.from && banner.from > today) return 'Scheduled';
  return 'Live';
}

/** The audience line a banner shows in the list. */
export function bannerAudienceCopy(banner: PatientBanner): string {
  return banner.audience === 'Patients of a department'
    ? `${banner.audienceDept || 'Department'} patients`
    : banner.audience;
}
