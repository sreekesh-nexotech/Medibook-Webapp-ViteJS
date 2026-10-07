import { describe, expect, it } from 'vitest';

import type {
  BillingInvoice,
  BillingPlan,
} from '@/features/settlements/domain/entities/billing.entities';
import {
  graceNotice,
  planChoices,
} from '@/features/settlements/presentation/components/planBillingView';

function plan(id: string, name: string, yearly: number | null = 1_000_000): BillingPlan {
  return {
    id,
    code: id.toUpperCase(),
    name,
    priceMonthlyPaise: 100_000,
    priceYearlyPaise: yearly,
    gstRateBp: 1800,
  };
}

const STARTER = plan('starter', 'Starter', null);
const GROWTH = plan('growth', 'Growth');
const ENTERPRISE = plan('enterprise', 'Enterprise');

function invoice(over: Partial<BillingInvoice>): BillingInvoice {
  return {
    id: 'inv',
    invoiceNo: 'INV-1',
    periodStart: '2026-09-01',
    periodEnd: '2026-09-30',
    issuedAt: '2026-09-01T00:00:00Z',
    dueAt: '2026-09-10',
    subtotalPaise: 100_000,
    gstPaise: 18_000,
    totalPaise: 118_000,
    amountPaidPaise: 0,
    status: 'overdue',
    paidAt: null,
    graceEndsAt: null,
    ...over,
  };
}

describe('planChoices', () => {
  it('offers the current plan on its other billing cycle only (appendix 09 F5)', () => {
    const choices = planChoices([STARTER, GROWTH, ENTERPRISE], {
      plan: GROWTH,
      billingPeriod: 'monthly',
    });
    const growth = choices.find((c) => c.plan.id === 'growth');
    expect(growth).toMatchObject({ isCurrent: true, cycles: ['yearly'] });
    expect(growth?.label).toBe('Growth — current plan');
    expect(choices.find((c) => c.plan.id === 'enterprise')?.cycles).toEqual(['monthly', 'yearly']);
  });

  it('leaves the current plan out when it has no other cycle', () => {
    const choices = planChoices([STARTER, GROWTH], { plan: STARTER, billingPeriod: 'monthly' });
    expect(choices.map((c) => c.plan.id)).toEqual(['growth']);
  });

  it('offers monthly only on a plan without a yearly price', () => {
    const choices = planChoices([STARTER], { plan: GROWTH, billingPeriod: 'yearly' });
    expect(choices[0]?.cycles).toEqual(['monthly']);
  });

  it('keeps labels unique when two plans share a name', () => {
    const twin = { ...GROWTH, id: 'growth-2', code: 'GROWTH_2' };
    const labels = planChoices([GROWTH, twin], null).map((c) => c.label);
    expect(labels).toEqual(['Growth (GROWTH)', 'Growth (GROWTH_2)']);
  });
});

describe('graceNotice', () => {
  const TODAY = '2026-09-14';

  it('says nothing unless the subscription is past due or in grace', () => {
    expect(
      graceNotice({ status: 'active', graceDaysOverride: null }, [invoice({})], TODAY),
    ).toBeNull();
    expect(
      graceNotice({ status: 'read_only', graceDaysOverride: null }, [invoice({})], TODAY),
    ).toBeNull();
  });

  it('counts seven days from the oldest unpaid due invoice by default (D-30)', () => {
    const notice = graceNotice(
      { status: 'grace', graceDaysOverride: null },
      [
        invoice({ id: 'b', invoiceNo: 'INV-2', dueAt: '2026-09-12' }),
        invoice({ id: 'a', invoiceNo: 'INV-1', dueAt: '2026-09-10' }),
        invoice({ id: 'c', status: 'paid', dueAt: '2026-09-01' }),
      ],
      TODAY,
    );
    expect(notice?.invoice.invoiceNo).toBe('INV-1');
    expect(notice?.endsOn).toBe('2026-09-17');
  });

  it('uses the hospital’s grace days, and the invoice’s own end date first', () => {
    const subscription = { status: 'past_due', graceDaysOverride: 10 };
    expect(graceNotice(subscription, [invoice({})], TODAY)?.endsOn).toBe('2026-09-20');
    expect(graceNotice(subscription, [invoice({ graceEndsAt: '2026-09-30' })], TODAY)?.endsOn).toBe(
      '2026-09-30',
    );
  });

  it('ignores invoices not yet due', () => {
    expect(
      graceNotice(
        { status: 'grace', graceDaysOverride: null },
        [invoice({ dueAt: '2026-09-20' })],
        TODAY,
      ),
    ).toBeNull();
  });
});
