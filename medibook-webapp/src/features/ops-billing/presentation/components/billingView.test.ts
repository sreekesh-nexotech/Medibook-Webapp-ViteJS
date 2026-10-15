import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  BillingInvoice,
  BillingSubscription,
} from '@/features/ops-billing/domain/entities/billing.entities';
import {
  dateOf,
  graceFor,
  ratePercent,
  reminderSummary,
  subscriptionBadge,
} from '@/features/ops-billing/presentation/components/billingView';

const invoice: BillingInvoice = {
  id: 'inv-1',
  invoiceNo: 'INV-2026-0001',
  hospitalId: 'h-1',
  hospitalName: 'City Care',
  subscriptionId: 's-1',
  periodStart: '2026-10-01',
  periodEnd: '2026-10-31',
  issuedAt: '2026-10-01T04:00:00Z',
  dueAt: '2026-10-05',
  subtotalPaise: 100_000,
  gstPaise: 18_000,
  totalPaise: 118_000,
  amountPaidPaise: 0,
  status: 'overdue',
  paidAt: null,
  graceEndsAt: null,
  remindersSent: 0,
  lastReminderAt: null,
  lastReminderSentAt: null,
  reminderStatus: null,
  planName: 'Growth',
  version: 1,
};

const subscription: BillingSubscription = {
  id: 's-1',
  hospitalId: 'h-1',
  hospitalName: 'City Care',
  planId: 'p-1',
  planCode: 'growth',
  planName: 'Growth',
  billingPeriod: 'monthly',
  status: 'grace',
  readOnly: false,
  startedAt: '2026-01-01T00:00:00Z',
  trialEndsAt: null,
  currentPeriodEnd: '2026-10-31',
  nextInvoiceAt: '2026-11-01',
  cancelAtPeriodEnd: false,
  graceDaysOverride: null,
  version: 3,
};

describe('subscriptionBadge (11·F12)', () => {
  it('labels the D-30 states', () => {
    expect(subscriptionBadge('read_only')).toEqual({ status: 'Blocked', label: 'Read-only' });
    expect(subscriptionBadge('grace').label).toBe('In grace');
    expect(subscriptionBadge('trialing').label).toBe('Trial');
  });

  it('shows an unknown status as itself rather than guessing', () => {
    expect(subscriptionBadge('paused')).toEqual({ status: 'Inactive', label: 'paused' });
  });
});

describe('reminderSummary (UAT-56)', () => {
  it('reports nothing queued', () => {
    expect(reminderSummary(invoice).badge.label).toBe('None');
  });

  it('calls a delivered reminder Sent', () => {
    const view = reminderSummary({
      ...invoice,
      remindersSent: 2,
      lastReminderAt: '2026-10-06T04:30:00Z',
      lastReminderSentAt: '2026-10-06T04:31:00Z',
      reminderStatus: 'sent',
    });
    expect(view.badge.label).toBe('Sent');
    expect(view.detail).toContain('2 reminders queued');
    expect(view.detail).toContain('last delivered');
  });

  it('keeps a queued, undelivered reminder as Queued', () => {
    const view = reminderSummary({
      ...invoice,
      remindersSent: 1,
      lastReminderAt: '2026-10-06T04:30:00Z',
      reminderStatus: 'queued',
    });
    expect(view.badge.label).toBe('Queued');
    expect(view.detail).toContain('not delivered yet');
  });

  it('never claims Sent on a backend that does not report delivery', () => {
    const view = reminderSummary({
      ...invoice,
      remindersSent: 3,
      lastReminderAt: '2026-10-06T04:30:00Z',
    });
    expect(view.badge.label).toBe('Queued');
    expect(view.detail).not.toContain('not delivered');
  });
});

describe('graceFor (11·F13)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T10:00:00+05:30'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses the platform default when it is known', () => {
    const grace = graceFor(invoice, subscription, 10);
    expect(grace).toMatchObject({ endsIso: '2026-10-15', source: 'platform', estimated: false });
    expect(grace?.inGrace).toBe(true);
  });

  it('marks the seeded default as an estimate when settings cannot be read', () => {
    expect(graceFor(invoice, subscription, null)).toMatchObject({
      endsIso: '2026-10-12',
      source: 'platform',
      estimated: true,
    });
  });

  it('prefers the hospital override, then the date the server set', () => {
    expect(graceFor(invoice, { ...subscription, graceDaysOverride: 3 }, null)).toMatchObject({
      endsIso: '2026-10-08',
      source: 'hospital',
      estimated: false,
    });
    expect(graceFor({ ...invoice, graceEndsAt: '2026-10-06' }, subscription, 10)).toMatchObject({
      endsIso: '2026-10-06',
      source: 'invoice',
      expired: true,
    });
  });

  it('has no window for a paid invoice', () => {
    expect(graceFor({ ...invoice, status: 'paid' }, subscription, 10)).toBeNull();
  });
});

describe('ratePercent', () => {
  it('turns basis points into a percentage', () => {
    expect(ratePercent(1800)).toBe('18%');
    expect(ratePercent(250)).toBe('2.5%');
  });
});

describe('dateOf (11·F6)', () => {
  it('uses the local (IST) calendar day, not the UTC prefix', () => {
    expect(dateOf('2026-10-06T20:00:00Z')).toBe('2026-10-07');
    expect(dateOf('2026-10-07T00:30:00+05:30')).toBe('2026-10-07');
  });

  it('passes a bare date through', () => {
    expect(dateOf('2026-10-07')).toBe('2026-10-07');
  });
});
