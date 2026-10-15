import { describe, expect, it } from 'vitest';

import {
  DELIVERY_STATUSES,
  type DeliveryFilters,
} from '@/features/messaging/domain/entities/messaging.entities';
import { toDeliveryQueryParams } from '@/features/messaging/infrastructure/data-sources/remote/messaging.request';
import {
  deliveryResponseSchema,
  toMessageDelivery,
} from '@/features/messaging/infrastructure/data-sources/remote/messaging.response';
import {
  deliveryErrorText,
  deliveryStatusBadge,
  messageableAppointments,
  templateTime,
} from '@/features/messaging/presentation/components/messaging.labels';
import type { PatientAppointment } from '@/features/patients/domain/entities/patients.entities';
import { todayISO } from '@/shared/lib/format';
import { todayIn } from '@/shared/lib/hospitalTime';
import { HOSPITAL_DATE, HOSPITAL_TIME_ZONE, PC_DATE, withPcBehindHospital } from '@/test/pcClock';

describe('delivery status badges (UAT-65)', () => {
  it('never shows a message that did not arrive as queued', () => {
    const queued = deliveryStatusBadge('queued').status;
    for (const status of ['failed', 'bounced', 'suppressed', 'cancelled'] as const) {
      expect(deliveryStatusBadge(status).status).not.toBe(queued);
    }
    expect(deliveryStatusBadge('bounced').label).toBe('Bounced');
    expect(deliveryStatusBadge('sending').label).toBe('Sending');
  });

  it('labels every status the backend sends (B7 adds sending)', () => {
    expect(DELIVERY_STATUSES).toContain('sending');
    for (const status of DELIVERY_STATUSES) expect(deliveryStatusBadge(status).label).not.toBe('');
  });

  it('explains the B7 error codes', () => {
    expect(deliveryErrorText('OUTCOME_UNKNOWN')).toMatch(/not sent again/);
    expect(deliveryErrorText(null)).toBeNull();
    expect(deliveryErrorText('SOMETHING_NEW')).toBeNull();
  });
});

describe('templateTime', () => {
  it('writes the time as the server does (%I:%M %p)', () => {
    // 05:00 UTC is 10:30 in IST.
    expect(templateTime('2026-10-07T05:00:00Z', 'Asia/Kolkata')).toBe('10:30 AM');
  });

  it('writes it in the hospital’s zone, whatever the PC’s', () => {
    expect(templateTime('2026-10-07T05:00:00Z', 'Asia/Dubai')).toBe('09:00 AM');
  });
});

const appointment = (
  id: string,
  scheduledDate: string,
  status: PatientAppointment['status'] = 'scheduled',
): PatientAppointment => ({
  id,
  bookingRef: `MB-${id}`,
  status,
  source: 'walk_in',
  doctorName: 'Dr. Suresh Pillai',
  departmentName: 'General Medicine',
  scheduledDate,
  scheduledStartAt: `${scheduledDate}T04:30:00Z`,
  tokenLabel: null,
  paymentStatus: 'paid',
  totalPaise: 50000,
});

describe('messageableAppointments', () => {
  it('keeps active bookings from today on, soonest first', () => {
    const picked = messageableAppointments(
      [
        appointment('b', '2026-10-10'),
        appointment('a', '2026-10-08'),
        appointment('x', '2026-10-09', 'cancelled'),
        appointment('y', '2026-10-01'),
      ],
      '2026-10-08',
    );
    expect(picked.map((a) => a.id)).toEqual(['a', 'b']);
  });
});

describe('messageable bookings on a PC behind the hospital (UAT-47)', () => {
  withPcBehindHospital();

  it('drops yesterday’s booking, though the PC is still on that day', () => {
    expect(todayISO()).toBe(PC_DATE);
    const picked = messageableAppointments(
      [appointment('old', PC_DATE), appointment('today', HOSPITAL_DATE)],
      todayIn(HOSPITAL_TIME_ZONE, Date.now()),
    );
    expect(picked.map((a) => a.id)).toEqual(['today']);
  });

  it('writes the SMS time on the hospital’s clock: 01:30 there, 20:00 on the PC', () => {
    expect(templateTime(new Date(Date.now()).toISOString(), HOSPITAL_TIME_ZONE)).toBe('01:30 AM');
  });
});

describe('outbox query', () => {
  it('sends the date range and exact search the backend filters on', () => {
    const filters: DeliveryFilters = {
      status: 'bounced',
      channel: 'sms',
      dateFrom: '2026-10-01',
      dateTo: '2026-10-07',
      q: ' 9876543210 ',
    };
    expect(
      toDeliveryQueryParams({
        ...filters,
        page: 2,
        pageSize: 8,
        sortField: 'queued_at',
        sortDirection: 'desc',
      }),
    ).toEqual({
      page: 2,
      page_size: 8,
      sort: '-queued_at',
      status: 'bounced',
      channel: 'sms',
      date_from: '2026-10-01',
      date_to: '2026-10-07',
      q: '9876543210',
    });
  });

  it('reads the address source and hold the backend adds (B7)', () => {
    const d = toMessageDelivery(
      deliveryResponseSchema.parse({
        id: 'd-1',
        channel: 'sms',
        event_code: 'appointment.reminder',
        recipient_address: '+919800000001',
        recipient_source: 'account',
        status: 'sending',
        queued_at: '2026-10-07T05:00:00Z',
        error_code: 'OUTCOME_UNKNOWN',
        deferred_until: null,
        attempts: 1,
      }),
    );
    expect(d.recipientSource).toBe('account');
    expect(d.errorCode).toBe('OUTCOME_UNKNOWN');
    expect(d.attempts).toBe(1);
  });
});
