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

/**
 * What a schedule change does to the money on the bookings it cancels. The
 * backend refunds the doctor's booking fee (Q11), but its affected-booking items
 * (`materialise._booking_ref`: ref, token, status, time, patient) carry no
 * payment state, so an unpaid walk-in cannot be told from a prepaid booking.
 * The copy must not promise a refund that never happens.
 */
/** Q11: a hospital-side cancellation refunds the doctor's fee; the convenience fee is kept. */
export const CANCEL_REFUND_NOTE = "the doctor's fee of a paid booking is refunded";

/** "1 booking cancelled (the doctor's fee of a paid booking is refunded)" */
export function cancelledBookingsCopy(n: number): string {
  return `${n} booking${n === 1 ? '' : 's'} cancelled (${CANCEL_REFUND_NOTE})`;
}

/** "2 bookings were made after the preview and were also cancelled (…): Asha Rao (BK-1), …" */
export function unpreviewedCopy(bookings: readonly AffectedBooking[]): string {
  const n = bookings.length;
  const names = bookings.map((b) => `${b.patientName} (${b.bookingRef})`).join(', ');
  return `${n} booking${n === 1 ? ' was' : 's were'} made after the preview and ${
    n === 1 ? 'was' : 'were'
  } also cancelled (${CANCEL_REFUND_NOTE}): ${names}.`;
}
