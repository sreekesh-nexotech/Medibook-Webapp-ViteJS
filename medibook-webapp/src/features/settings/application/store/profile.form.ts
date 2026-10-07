/**
 * Pure rules for the Hospital Profile screen (module H4) over the API
 * entities: closure scope and span, banner audience labels, the date ↔
 * date-time mapping the banner window needs, and a banner's publication
 * state. No React, no store, no I/O.
 */

import { toLocalISO } from '@/shared/lib/format';

import type {
  AffectedBooking,
  BannerAudience,
  Holiday,
  HospitalBanner,
} from '@/features/settings/domain/entities/profile.entities';

/* ------------------------------------------------------------------ holidays */

/** What a closure can cover — the backend has no branch scope. */
export const HOLIDAY_SCOPE_OPTIONS = ['Whole hospital', 'Department'] as const;

export type HolidayScopeOption = (typeof HOLIDAY_SCOPE_OPTIONS)[number];

export function holidayScopeOf(holiday: Holiday): HolidayScopeOption {
  return holiday.departmentId === null ? 'Whole hospital' : 'Department';
}

/** "Whole hospital" or the department's name, for display. */
export function holidayAppliesTo(
  holiday: Holiday,
  departmentNames: ReadonlyMap<string, string>,
): string {
  if (holiday.departmentId === null) return 'Whole hospital';
  return departmentNames.get(holiday.departmentId) ?? 'Unknown department';
}

const MS_PER_DAY = 86_400_000;
const NOON_HOUR = 12;

function localNoon(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, NOON_HOUR);
}

/** Days a closure spans, both ends inclusive (1 for a single day; 0 if inverted). */
export function holidayDayCount(from: string, to: string): number {
  if (!from || !to || to < from) return 0;
  return Math.round((localNoon(to).getTime() - localNoon(from).getTime()) / MS_PER_DAY) + 1;
}

/** Closed days of `holiday` that fall inside `[windowFrom, windowTo]`. */
export function holidayDaysWithin(holiday: Holiday, windowFrom: string, windowTo: string): number {
  const from = holiday.from > windowFrom ? holiday.from : windowFrom;
  const to = holiday.to < windowTo ? holiday.to : windowTo;
  return holidayDayCount(from, to);
}

/**
 * Distinct calendar days inside `[windowFrom, windowTo]` that at least one of
 * `holidays` closes — overlapping closures count each day once (07·P-F3).
 */
export function closedDaysWithin(
  holidays: readonly Holiday[],
  windowFrom: string,
  windowTo: string,
): number {
  const days = new Set<string>();
  for (const h of holidays) {
    const from = h.from > windowFrom ? h.from : windowFrom;
    const to = h.to < windowTo ? h.to : windowTo;
    const count = holidayDayCount(from, to);
    const start = localNoon(from);
    for (let i = 0; i < count; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.add(toLocalISO(d));
    }
  }
  return days.size;
}

/** How many bookings to name in the confirm dialog before summarising the rest. */
const AFFECTED_PREVIEW_COUNT = 3;

/** "APT-1042 (Asha R.), APT-1043 (Vikram S.) and 4 more" */
export function affectedBookingsCopy(bookings: readonly AffectedBooking[]): string {
  const named = bookings
    .slice(0, AFFECTED_PREVIEW_COUNT)
    .map((b) => `${b.bookingRef} (${b.patientName})`);
  const rest = bookings.length - named.length;
  return rest > 0 ? `${named.join(', ')} and ${rest} more` : named.join(', ');
}

/* ------------------------------------------------------------------- banners */

/** The two audiences the backend supports, as the modal labels them. */
export const BANNER_AUDIENCE_LABEL: Readonly<Record<BannerAudience, string>> = {
  hospital_patients: 'Patients of this hospital',
  all_patients_in_city: 'All patients in the city',
};

export const BANNER_AUDIENCE_OPTIONS: readonly string[] = Object.values(BANNER_AUDIENCE_LABEL);

export function audienceForLabel(label: string): BannerAudience {
  return label === BANNER_AUDIENCE_LABEL.all_patients_in_city
    ? 'all_patients_in_city'
    : 'hospital_patients';
}

const END_OF_DAY_HOUR = 23;
const END_OF_DAY_MINUTE = 59;
const END_OF_DAY_SECOND = 59;

/** `yyyy-mm-dd` → the start of that day in the browser's time zone, as ISO. */
export function dayStartIso(date: string): string {
  const d = localNoon(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** `yyyy-mm-dd` → the last second of that day in the browser's time zone, as ISO. */
export function dayEndIso(date: string): string {
  const d = localNoon(date);
  d.setHours(END_OF_DAY_HOUR, END_OF_DAY_MINUTE, END_OF_DAY_SECOND, 0);
  return d.toISOString();
}

/** An ISO date-time as the local `yyyy-mm-dd` it falls on; `''` for none. */
export function localDateOf(dateTime: string | null): string {
  if (!dateTime) return '';
  const d = new Date(dateTime);
  return Number.isNaN(d.getTime()) ? '' : toLocalISO(d);
}

/**
 * Where a banner stands right now. `Hidden` is enabled and inside its window
 * but not `published` — the server holds it back because the hospital is not
 * visible in the patient app.
 */
export type BannerStatus = 'Live' | 'Scheduled' | 'Expired' | 'Paused' | 'Hidden';

export function bannerStatusAt(banner: HospitalBanner, now: Date): BannerStatus {
  if (!banner.isEnabled) return 'Paused';
  const t = now.getTime();
  if (banner.endsAt && new Date(banner.endsAt).getTime() < t) return 'Expired';
  if (banner.startsAt && new Date(banner.startsAt).getTime() > t) return 'Scheduled';
  return banner.published ? 'Live' : 'Hidden';
}

/** "12 Oct 2026 – 20 Oct 2026"-style window, with open ends spelled out. */
export function bannerWindow(banner: HospitalBanner): { from: string; to: string } {
  return { from: localDateOf(banner.startsAt), to: localDateOf(banner.endsAt) };
}

/** `ordered` with the item at `index` swapped with its neighbour in `dir`. */
export function moved<T>(ordered: readonly T[], index: number, dir: -1 | 1): readonly T[] {
  const to = index + dir;
  const a = ordered[index];
  const b = ordered[to];
  if (a === undefined || b === undefined) return ordered;
  const next = [...ordered];
  next[index] = b;
  next[to] = a;
  return next;
}
