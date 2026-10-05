/**
 * Platform usage analytics (`/platform/analytics/*`), read from the backend's
 * nightly rollups — so every window ends **yesterday**, the last rolled-up
 * day. Money is whole rupees here; the paise the API uses never leave the
 * infrastructure layer.
 */

/** The reporting windows the backend accepts (`?period=`). */
export type AnalyticsPeriodCode = '7d' | '30d' | '90d' | '12m';

/** The dates a response actually covers (ISO `yyyy-mm-dd`, inclusive). */
export interface AnalyticsWindow {
  readonly period: AnalyticsPeriodCode;
  readonly dateFrom: string;
  readonly dateTo: string;
}

/** Platform-wide booking totals for the window. */
export interface AnalyticsOverview {
  readonly window: AnalyticsWindow;
  readonly bookingsTotal: number;
  readonly bookingsOnline: number;
  readonly bookingsWalkIn: number;
  readonly completed: number;
  readonly cancellations: number;
  readonly noShows: number;
  readonly revenueRupees: number;
  readonly refundsRupees: number;
  readonly newPatients: number;
}

/** Bookings in one calendar month of the window. */
export interface MonthlyBookings {
  /** `yyyy-mm`. */
  readonly month: string;
  readonly online: number;
  readonly walkIn: number;
  readonly total: number;
}

/** One department code's share of the window's bookings, across hospitals. */
export interface DepartmentShare {
  /** Per-hospital department code (e.g. `general_medicine`); no name platform-wide. */
  readonly departmentCode: string;
  readonly bookings: number;
  /** Share of all bookings, in percent (two decimals). */
  readonly sharePct: number;
}

export interface TopHospital {
  readonly hospitalId: string;
  /** `null` when the hospital has since been removed. */
  readonly name: string | null;
  readonly bookings: number;
  readonly revenueRupees: number;
}

/** One third-party provider's metered usage (`sms`, `email`, `razorpay`, …). */
export interface ProviderUsage {
  readonly provider: string;
  readonly requests: number;
  readonly messages: number;
  readonly errors: number;
  readonly costRupees: number;
}

/** Request and error counts for one API surface + endpoint group. */
export interface ApiErrorRow {
  /** `patient` | `hospital` | `platform` | `display` | `shared` | `webhook`. */
  readonly surface: string;
  /** The backend app that owns the endpoints (`appointments`, `tokens`, …). */
  readonly endpointGroup: string;
  readonly requests: number;
  readonly errors4xx: number;
  readonly errors5xx: number;
  /** Worst daily p95 latency in the window, in ms. */
  readonly p95Ms: number;
  /** (4xx + 5xx) / requests, in percent (two decimals). */
  readonly errorPct: number;
}

/** A list endpoint's rows together with the window they cover. */
export interface AnalyticsList<T> {
  readonly window: AnalyticsWindow;
  readonly items: readonly T[];
}

/** An error share at or above this is flagged (percent). */
export const ERROR_PCT_WARNING = 1;
/** …and at or above this, critical. */
export const ERROR_PCT_CRITICAL = 2.5;
/** A p95 latency at or above this is flagged (ms). */
export const P95_WARNING_MS = 800;
/** …and at or above this, critical. */
export const P95_CRITICAL_MS = 1500;
