import { describe, expect, it } from 'vitest';

import type { AppointmentListParams } from '@/features/appointments/domain/entities/appointments.entities';
import {
  sortParam,
  toListQuery,
} from '@/features/appointments/infrastructure/data-sources/remote/appointments.api';
import {
  cancellationResponseSchema,
  quoteResponseSchema,
  toFeeQuote,
  toRefundOutcome,
} from '@/features/appointments/infrastructure/data-sources/remote/appointments.response';

/** A real appointment recorded from the backend (contract fixtures). */
const fixtures = import.meta.glob<unknown>(
  '/src/test/contract/fixtures/appointments.appointmentResponseSchema.json',
  { eager: true, import: 'default' },
);
const APPOINTMENT_FIXTURE =
  '/src/test/contract/fixtures/appointments.appointmentResponseSchema.json';

const BASE: AppointmentListParams = {
  dateFrom: '2026-10-07',
  dateTo: '2026-10-07',
  statuses: [],
  source: null,
  paymentStatus: null,
  departmentId: null,
  doctorId: null,
  q: '',
  sort: { field: 'scheduled_start_at', direction: 'asc' },
  page: 1,
  pageSize: 8,
};

describe('desk list query string', () => {
  it('sends only the filters in use', () => {
    expect(toListQuery(BASE)).toEqual({
      date_from: '2026-10-07',
      date_to: '2026-10-07',
      sort: 'scheduled_start_at,token_no,booking_ref',
      page: 1,
      page_size: 8,
    });
  });

  it('sends every allowlisted filter it is given', () => {
    expect(
      toListQuery({
        ...BASE,
        statuses: ['checked_in', 'in_consultation'],
        source: 'walk_in',
        paymentStatus: 'unpaid',
        departmentId: 'dep',
        doctorId: 'doc',
        q: '  W007 ',
        page: 3,
      }),
    ).toMatchObject({
      status: 'checked_in,in_consultation',
      source: 'walk_in',
      payment_status: 'unpaid',
      department_id: 'dep',
      doctor_id: 'doc',
      q: 'W007',
      page: 3,
    });
  });

  it('keeps ties in one stable order in either direction', () => {
    expect(sortParam({ field: 'scheduled_start_at', direction: 'desc' })).toBe(
      '-scheduled_start_at,-token_no,-booking_ref',
    );
    expect(sortParam({ field: 'booking_ref', direction: 'asc' })).toBe('booking_ref');
  });
});

describe('fee quote (APPT-05)', () => {
  it('reads the backend quote in rupees', () => {
    const quote = toFeeQuote(
      quoteResponseSchema.parse({
        hospital_patient_id: null,
        consultations: [
          {
            index: 0,
            doctor_id: 'd1',
            service_id: null,
            slot_id: null,
            date: '2026-10-07',
            consultation_fee_paise: 50000,
            service_fee_paise: 20000,
            discount_paise: 0,
            convenience_fee_paise: 0,
            tax_paise: 3600,
            tax_lines: [],
            total_paise: 73600,
            is_follow_up: false,
            currency: 'INR',
          },
        ],
        total_paise: 73600,
        currency: 'INR',
      }),
    );
    expect(quote.totalRupees).toBe(736);
    expect(quote.consultations[0]).toMatchObject({
      index: 0,
      consultationRupees: 500,
      serviceRupees: 200,
      taxRupees: 36,
      isFollowUp: false,
    });
  });
});

describe('cancel / reject response on both backend versions', () => {
  const appointment = fixtures[APPOINTMENT_FIXTURE];

  it('reads no refunds from an older backend', () => {
    const outcome = toRefundOutcome(cancellationResponseSchema.parse({ appointment }));
    expect(outcome.refunds).toEqual([]);
  });

  it('reads each refund a cancel started, including a superseded one (B3)', () => {
    const outcome = toRefundOutcome(
      cancellationResponseSchema.parse({
        appointment,
        refunds: [
          { id: 'r1', amount_paise: 30000, status: 'processing', method: 'upi' },
          { id: 'r2', amount_paise: 20000, status: 'superseded' },
        ],
      }),
    );
    expect(outcome.refunds).toEqual([
      { id: 'r1', amountRupees: 300, status: 'processing', method: 'upi' },
      { id: 'r2', amountRupees: 200, status: 'superseded', method: null },
    ]);
  });
});
