import type { Failure } from '@/core/error/failure';
import { isFailure } from '@/core/error/failure';

import type { AffectedBooking } from '@/features/doctors/domain/entities/doctors.types';

/**
 * Pure rules of the dry-run → confirm flow (Q32, Q73), kept apart from the
 * hook so they can be tested without React.
 */

/**
 * 409 codes the backend uses when a confirm no longer matches its dry run
 * (B5 contract, L-17/BE-33): `PREVIEW_TOKEN_STALE` (the affected bookings
 * changed since the preview) and `PREVIEW_TOKEN_REQUIRED` (a confirm that
 * would cancel bookings arrived without a token). Both carry the new list
 * and token in `meta`; a 409 with that `meta` counts too.
 */
export const PREVIEW_STALE_CODES: ReadonlySet<string> = new Set([
  'PREVIEW_TOKEN_STALE',
  'PREVIEW_TOKEN_REQUIRED',
]);

const PREVIEW_META_KEYS = ['affected_bookings', 'preview_token'] as const;

/** The backend's answer to a replayed `Idempotency-Key` with a different request. */
export const IDEMPOTENCY_CONFLICT = 'IDEMPOTENCY_CONFLICT';

/** True when a confirm was refused because the affected bookings changed since the preview. */
export function isPreviewStale(error: unknown): boolean {
  if (!isFailure(error) || error.kind !== 'conflict') return false;
  if (error.code !== null && PREVIEW_STALE_CODES.has(error.code)) return true;
  return PREVIEW_META_KEYS.some((key) => key in error.meta);
}

/** True when the replay key was already used — the change may already be applied. */
export function isIdempotencyConflict(error: unknown): error is Failure {
  return isFailure(error) && error.code === IDEMPOTENCY_CONFLICT;
}

/**
 * Bookings the applied change cancelled that the dry run did not list —
 * made between preview and confirm on a backend that does not bind the
 * confirm to the preview (07·P-F7). The user must hear about them.
 */
export function unpreviewedBookings(
  previewed: readonly AffectedBooking[],
  applied: readonly AffectedBooking[],
): readonly AffectedBooking[] {
  const seen = new Set(previewed.map((b) => b.appointmentId));
  return applied.filter((b) => !seen.has(b.appointmentId));
}

/** "2 more bookings were cancelled and refunded: Asha Rao (BK-1), …" */
export function unpreviewedCopy(bookings: readonly AffectedBooking[]): string {
  const n = bookings.length;
  const names = bookings.map((b) => `${b.patientName} (${b.bookingRef})`).join(', ');
  return `${n} booking${n === 1 ? ' was' : 's were'} made after the preview and ${
    n === 1 ? 'was' : 'were'
  } also cancelled and refunded: ${names}.`;
}
