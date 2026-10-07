/**
 * Pure rules for the Hospital Profile screen (module H4) over the API
 * entities: closure scope and span, the banner button's app link, the date ↔
 * date-time mapping the banner window needs, and a banner's publication
 * state. No React, no store, no I/O.
 */

import { calendarDate, calendarInstant, toLocalISO } from '@/shared/lib/format';
import { addIsoDays } from '@/shared/lib/hospitalTime';

import type {
  AffectedBooking,
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

/** The upcoming-closures summary of the Holiday Calendar. */
export interface UpcomingClosures {
  /** Closures that end on or after `today` and start inside the window. */
  readonly upcoming: readonly Holiday[];
  /** Distinct whole-hospital closed days in the window (07·P-F3). */
  readonly closedDays: number;
  /** Department closures in the window, counted apart. */
  readonly departmentClosures: number;
  /** The earliest upcoming closure, if any. */
  readonly next: Holiday | null;
}

/**
 * Closures in the `horizonDays` from `today` — the hospital's calendar day
 * (`useHospitalToday`, D-09, UAT-47), so a desk PC on another date neither
 * drops today's closure nor counts yesterday's.
 */
export function upcomingClosures(
  holidays: readonly Holiday[],
  today: string,
  horizonDays: number,
): UpcomingClosures {
  const horizonEnd = addIsoDays(today, horizonDays);
  const upcoming = holidays.filter((h) => h.to >= today && h.from <= horizonEnd);
  return {
    upcoming,
    closedDays: closedDaysWithin(
      upcoming.filter((h) => h.departmentId === null),
      today,
      horizonEnd,
    ),
    departmentClosures: upcoming.filter((h) => h.departmentId !== null).length,
    next: [...upcoming].sort((a, b) => a.from.localeCompare(b.from))[0] ?? null,
  };
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

/**
 * Where a banner's button leads in the patient app: one of the app's own deep
 * links (`app_routes.dart` `inAppPathFor` accepts `medibook://…` and
 * `https://medibook.app/…`). The backend stores the link as text.
 */
export type BannerCtaAction = 'none' | 'booking' | 'hospital' | 'doctor' | 'other';

export const BANNER_CTA_ACTION_LABEL: Readonly<Record<BannerCtaAction, string>> = {
  none: 'No button',
  booking: 'Book an appointment',
  hospital: "Open the hospital's page",
  doctor: "Open a doctor's profile",
  other: 'Another app link',
};

export const BANNER_CTA_ACTION_OPTIONS: readonly string[] = Object.values(BANNER_CTA_ACTION_LABEL);

export function ctaActionForLabel(label: string): BannerCtaAction {
  const found = (Object.keys(BANNER_CTA_ACTION_LABEL) as BannerCtaAction[]).find(
    (k) => BANNER_CTA_ACTION_LABEL[k] === label,
  );
  return found ?? 'none';
}

const DEEP_LINK = 'medibook://';
const BOOKING_LINK = `${DEEP_LINK}booking`;
const HOSPITAL_LINK = `${DEEP_LINK}hospital/`;
const DOCTOR_LINK = `${DEEP_LINK}doctor/`;
/** The links the patient app opens; anything else shows its not-found screen. */
const APP_LINK = /^(medibook:\/\/|https:\/\/(www\.)?medibook\.app\/)\S*$/;

/** A stored button link read back as the choice that made it. */
export interface BannerCta {
  readonly action: BannerCtaAction;
  /** The doctor a `doctor` link opens. */
  readonly doctorId: string;
  /** The link itself, for `other`. */
  readonly link: string;
}

export function bannerCtaOf(target: string | null): BannerCta {
  if (!target) return { action: 'none', doctorId: '', link: '' };
  if (target === BOOKING_LINK) return { action: 'booking', doctorId: '', link: '' };
  if (target.startsWith(HOSPITAL_LINK)) return { action: 'hospital', doctorId: '', link: '' };
  if (target.startsWith(DOCTOR_LINK)) {
    return { action: 'doctor', doctorId: target.slice(DOCTOR_LINK.length), link: '' };
  }
  return { action: 'other', doctorId: '', link: target };
}

/** The link to store for a choice; `null` when there is no button. */
export function bannerCtaTarget(cta: BannerCta, hospitalId: string): string | null {
  switch (cta.action) {
    case 'none':
      return null;
    case 'booking':
      return BOOKING_LINK;
    case 'hospital':
      return `${HOSPITAL_LINK}${hospitalId}`;
    case 'doctor':
      return `${DOCTOR_LINK}${cta.doctorId}`;
    case 'other':
      return cta.link.trim();
  }
}

/** `undefined` when `link` is one the patient app can open. */
export function appLinkError(link: string): string | undefined {
  if (link.trim() === '') return 'Enter the app link the button opens.';
  return APP_LINK.test(link.trim())
    ? undefined
    : 'Use a Medibook app link, e.g. medibook://booking or https://medibook.app/…';
}

/** "Book now → Book an appointment" for the banner list. */
export function bannerCtaCopy(
  banner: HospitalBanner,
  doctorNames: ReadonlyMap<string, string>,
): string | null {
  if (!banner.ctaLabel || !banner.ctaTarget) return null;
  const cta = bannerCtaOf(banner.ctaTarget);
  const where =
    cta.action === 'doctor'
      ? (doctorNames.get(cta.doctorId) ?? "a doctor's profile")
      : cta.action === 'other'
        ? cta.link
        : BANNER_CTA_ACTION_LABEL[cta.action];
  return `Button “${banner.ctaLabel}” → ${where}`;
}

/** The last second of a day, for inclusive end dates. */
const END_OF_DAY = '23:59:59';

/** `yyyy-mm-dd` → the start of that day in the hospital's zone (DATA-03). */
export function dayStartIso(date: string): string {
  return calendarInstant(date);
}

/** `yyyy-mm-dd` → the last second of that day in the hospital's zone. */
export function dayEndIso(date: string): string {
  return calendarInstant(date, END_OF_DAY);
}

/** An ISO date-time as the hospital day it falls on; `''` for none. */
export function localDateOf(dateTime: string | null): string {
  if (!dateTime) return '';
  const d = new Date(dateTime);
  return Number.isNaN(d.getTime()) ? '' : calendarDate(d);
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
