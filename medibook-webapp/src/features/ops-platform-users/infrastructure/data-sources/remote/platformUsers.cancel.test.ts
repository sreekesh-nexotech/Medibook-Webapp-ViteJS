import { describe, expect, it } from 'vitest';

import {
  cancelBookingsPreviewResponseSchema,
  cancelBookingsResultResponseSchema,
  toCancelBookingsPreview,
  toCancelBookingsResult,
} from '@/features/ops-platform-users/infrastructure/data-sources/remote/platformUsers.response';

const item = (ref: string, refund: number) => ({
  booking_ref: ref,
  hospital_name: 'Lakeshore Hospital',
  scheduled_start_at: '2026-11-09T04:30:00Z',
  refund_paise: refund,
});

describe('cancel-bookings preview (UAT T10)', () => {
  it('maps each booking and adds up the full refund in paise', () => {
    const preview = toCancelBookingsPreview(
      cancelBookingsPreviewResponseSchema.parse({
        bookings: [item('BK-1', 59000), item('BK-2', 41250)],
      }),
    );
    expect(preview.bookings).toEqual([
      {
        bookingRef: 'BK-1',
        hospitalName: 'Lakeshore Hospital',
        scheduledStartAt: '2026-11-09T04:30:00Z',
        refundPaise: 59000,
      },
      {
        bookingRef: 'BK-2',
        hospitalName: 'Lakeshore Hospital',
        scheduledStartAt: '2026-11-09T04:30:00Z',
        refundPaise: 41250,
      },
    ]);
    expect(preview.totalRefundPaise).toBe(100250);
  });

  it('is empty, with nothing to refund, when the patient has no paid upcoming bookings', () => {
    const preview = toCancelBookingsPreview(
      cancelBookingsPreviewResponseSchema.parse({ bookings: [] }),
    );
    expect(preview).toEqual({ bookings: [], totalRefundPaise: 0 });
  });

  it('rejects a fractional refund: money is whole paise', () => {
    expect(() =>
      cancelBookingsPreviewResponseSchema.parse({ bookings: [item('BK-1', 590.5)] }),
    ).toThrow();
  });
});

describe('cancel-bookings result', () => {
  it('lists the booking refs that were cancelled', () => {
    const result = toCancelBookingsResult(
      cancelBookingsResultResponseSchema.parse({ cancelled_booking_refs: ['BK-1', 'BK-2'] }),
    );
    expect(result.cancelledBookingRefs).toEqual(['BK-1', 'BK-2']);
  });
});
