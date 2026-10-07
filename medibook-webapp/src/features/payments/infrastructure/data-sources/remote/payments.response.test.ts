import { describe, expect, it } from 'vitest';

import {
  cashSessionResponseSchema,
  cashSummaryResponseSchema,
  paymentLineSchema,
  refundCreatedResponseSchema,
  toCashSession,
  toCashSummary,
  toPaymentLine,
  toPaymentRefund,
} from '@/features/payments/infrastructure/data-sources/remote/payments.response';

/** A `HospitalPaymentSerializer` row as today's backend sends it. */
const LINE = {
  id: 'pay-1',
  order_id: 'ord-1',
  appointment_id: 'appt-1',
  visit_id: null,
  channel: 'online',
  method: 'upi',
  amount_paise: 42400,
  status: 'captured',
  gateway: 'razorpay',
  gateway_payment_id: 'pay_x',
  captured_at: '2026-09-29T17:21:29Z',
  reference_note: null,
  collected_by_name: null,
  counter_code: null,
  cash_session_id: null,
  booking_refs: ['LKSB-2609-00179'],
  patient: { id: 'p-1', mrn: 'LKSM000006', full_name: 'Priya Nair' },
  created_at: '2026-09-29T17:21:29Z',
};

describe('payment lines', () => {
  it('read an older backend’s row, leaving the refund state “not said”', () => {
    const line = toPaymentLine(paymentLineSchema.parse(LINE));
    expect(line.orderId).toBe('ord-1');
    expect(line.gatewayPaymentId).toBe('pay_x');
    expect(line.doctorName).toBeNull();
    expect(line.bookingStatus).toBeNull();
    expect(line.latestRefund).toBeUndefined();
  });

  it('read doctor, department, booking status, receipt and latest refund (B3)', () => {
    const line = toPaymentLine(
      paymentLineSchema.parse({
        ...LINE,
        doctor: { id: 'd-1', name: 'Dr. Anya Sharma' },
        department: { id: 'dep-1', name: 'Cardiology' },
        appointment_status: 'cancelled',
        receipt_no: 'LKSR/26-27/00002',
        latest_refund: { id: 'r-1', status: 'processing', amount_paise: 42400 },
      }),
    );
    expect(line.doctorName).toBe('Dr. Anya Sharma');
    expect(line.departmentName).toBe('Cardiology');
    expect(line.bookingStatus).toBe('cancelled');
    expect(line.receiptNo).toBe('LKSR/26-27/00002');
    expect(line.latestRefund).toEqual({
      id: 'r-1',
      status: 'processing',
      amountRupees: 424,
      failureReason: null,
    });
  });

  it('read the flat refund fields and doctor names too', () => {
    const line = toPaymentLine(
      paymentLineSchema.parse({
        ...LINE,
        doctor_name: 'Dr. Rao',
        department_name: 'ENT',
        refund_status: null,
      }),
    );
    expect(line.doctorName).toBe('Dr. Rao');
    expect(line.latestRefund).toBeNull();
  });
});

describe('refunds', () => {
  it('parse the refund endpoint’s 201 body, superseded rows included', () => {
    const body = refundCreatedResponseSchema.parse({
      results: [
        {
          id: 'r-1',
          payment_id: 'pay-1',
          appointment_id: 'appt-1',
          booking_ref: 'LKSB-1',
          method: 'cash',
          amount_paise: 50000,
          reason: 'Doctor unavailable',
          status: 'superseded',
          initiated_by_kind: 'staff',
          requested_at: '2026-10-07T06:00:00Z',
          processed_at: null,
          failure_reason: null,
          cash_session_id: 'cs-1',
          policy_snapshot: {},
          created_at: '2026-10-07T06:00:00Z',
        },
      ],
    });
    const [first] = body.results;
    if (!first) throw new Error('the body should hold a refund');
    expect(toPaymentRefund(first)).toMatchObject({
      status: 'superseded',
      amountRupees: 500,
      cashSessionId: 'cs-1',
    });
  });
});

const SESSION = {
  id: 'cs-1',
  staff_id: 's-1',
  staff_name: 'Vineeth Kumar',
  counter_code: 'C1',
  business_date: '2026-10-06',
  opened_at: '2026-10-06T03:00:00Z',
  opening_float_paise: 50000,
  expected_cash_paise: 100000,
  counted_cash_paise: null,
  variance_paise: null,
  closed_at: '2026-10-06T18:29:00Z',
  close_note: null,
  status: 'closed',
  reconciled_at: null,
};

describe('cash sessions', () => {
  it('treat an older backend’s uncounted closed drawer as auto-closed, with no version', () => {
    const s = toCashSession(cashSessionResponseSchema.parse(SESSION));
    expect(s.isAutoClosed).toBe(true);
    expect(s.version).toBeNull();
  });

  it('read the version, closer and reconciler (B2)', () => {
    const s = toCashSession(
      cashSessionResponseSchema.parse({
        ...SESSION,
        counted_cash_paise: 95000,
        variance_paise: -5000,
        auto_closed: false,
        closed_by_name: 'Anita Menon',
        version: 4,
      }),
    );
    expect(s.isAutoClosed).toBe(false);
    expect(s.closedByName).toBe('Anita Menon');
    expect(s.version).toBe(4);
  });

  it('read a summary with each drawer and the day totals (B2)', () => {
    const summary = toCashSummary(
      cashSummaryResponseSchema.parse({
        date: '2026-10-06',
        scope: 'own',
        staff: [
          {
            staff_id: 's-1',
            staff_name: 'Vineeth Kumar',
            counters: ['C1'],
            open_sessions: 1,
            opening_float_paise: 50000,
            cash_in_paise: 50000,
            cash_refunds_paise: 0,
            expected_cash_paise: 100000,
            counted_cash_paise: null,
            counted_expected_paise: null,
            variance_paise: null,
            uncounted_sessions: 1,
            sessions: [
              {
                id: 'cs-1',
                status: 'open',
                counter_code: 'C1',
                opened_at: '2026-10-06T03:00:00Z',
                closed_at: null,
                auto_closed: false,
                opening_float_paise: 50000,
                cash_in_paise: 50000,
                cash_refunds_paise: 0,
                expected_cash_paise: 100000,
                counted_cash_paise: null,
                variance_paise: null,
                version: 2,
              },
            ],
          },
        ],
        totals: {
          opening_float_paise: 50000,
          cash_in_paise: 50000,
          cash_refunds_paise: 0,
          expected_cash_paise: 100000,
        },
      }),
    );
    expect(summary.scope).toBe('own');
    expect(summary.rows[0]?.drawers[0]).toMatchObject({ id: 'cs-1', status: 'open', version: 2 });
    expect(summary.totals?.expectedCashPaise).toBe(100000);
  });
});
