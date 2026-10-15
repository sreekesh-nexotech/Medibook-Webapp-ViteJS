import { describe, expect, it } from 'vitest';

import type { Failure } from '@/core/error/failure';

import type { AffectedBooking } from '@/features/doctors/domain/entities/doctors.types';
import {
  isIdempotencyConflict,
  isPreviewStale,
  unpreviewedBookings,
  unpreviewedCopy,
} from '@/features/doctors/presentation/components/scheduleConfirm';

function conflict(code: string, meta: Record<string, unknown> = {}): Failure {
  return {
    kind: 'conflict',
    message: 'Conflict.',
    code,
    status: 409,
    fieldErrors: {},
    requestId: null,
    meta,
  };
}

const booking = (id: string): AffectedBooking => ({
  appointmentId: id,
  bookingRef: `BK-${id}`,
  tokenLabel: null,
  patientName: `Patient ${id}`,
  scheduledStartAt: '2026-10-08T04:30:00Z',
});

describe('confirm bound to its preview (L-17, BE-33)', () => {
  it('recognises the stale-preview 409 by code or by the new list in meta', () => {
    expect(isPreviewStale(conflict('PREVIEW_TOKEN_STALE'))).toBe(true);
    expect(isPreviewStale(conflict('PREVIEW_TOKEN_REQUIRED'))).toBe(true);
    expect(isPreviewStale(conflict('STATE_CONFLICT', { affected_bookings: [] }))).toBe(true);
    expect(isPreviewStale(conflict('CONFLICT_VERSION'))).toBe(false);
    expect(isPreviewStale(new Error('x'))).toBe(false);
  });

  it('tells a replayed idempotency key apart', () => {
    expect(isIdempotencyConflict(conflict('IDEMPOTENCY_CONFLICT'))).toBe(true);
    expect(isIdempotencyConflict(conflict('SLOT_OVERLAP'))).toBe(false);
  });

  it('names bookings cancelled that the preview did not list (07·P-F7)', () => {
    const extra = unpreviewedBookings([booking('a')], [booking('a'), booking('b')]);
    expect(extra.map((b) => b.appointmentId)).toEqual(['b']);
    expect(unpreviewedCopy(extra)).toBe(
      '1 booking was made after the preview and was also cancelled and refunded: Patient b (BK-b).',
    );
  });
});
