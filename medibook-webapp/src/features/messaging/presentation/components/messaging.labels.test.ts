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
  templateTime,
} from '@/features/messaging/presentation/components/messaging.labels';

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
    // 05:00 UTC is 10:30 in IST, the test time zone.
    expect(templateTime('2026-10-07T05:00:00Z')).toBe('10:30 AM');
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
