/** Pure view logic for the Plan & Billing tab — no React. */

import { addDaysISO } from '@/shared/lib/format';

import type {
  BillingInvoice,
  BillingPeriod,
  BillingPlan,
  Subscription,
} from '@/features/settlements/domain/entities/billing.entities';

/** D-30: an unpaid invoice gets this many days of grace before read-only. */
export const DEFAULT_GRACE_DAYS = 7;

/** Invoice statuses that still need paying (backend `UNPAID_INVOICE`). */
export const UNPAID_INVOICE_STATUSES: ReadonlySet<string> = new Set(['issued', 'overdue']);

/** Subscription states in which an invoice is overdue but the hospital still has full access. */
const GRACE_STATUSES: ReadonlySet<string> = new Set(['past_due', 'grace']);

export const CYCLE_LABEL: Readonly<Record<BillingPeriod, string>> = {
  monthly: 'Monthly',
  yearly: 'Yearly',
};

/** One plan the hospital may ask for, with the billing cycles it may ask for on it. */
export interface PlanChoice {
  readonly plan: BillingPlan;
  /** Unique among the choices — what the select shows and the form keeps. */
  readonly label: string;
  readonly cycles: readonly BillingPeriod[];
  readonly isCurrent: boolean;
}

/**
 * The plans a change request may name (appendix 09 F5). The current plan
 * stays in the list when another billing cycle is available on it, so a
 * monthly-to-yearly change on the same plan can be asked for (the backend
 * refuses only "same plan, same cycle"). Labels are made unique, so the
 * choice resolves to a plan id, never to a name two plans share.
 */
export function planChoices(
  plans: readonly BillingPlan[],
  current: Pick<Subscription, 'plan' | 'billingPeriod'> | null,
): PlanChoice[] {
  const nameCount = new Map<string, number>();
  for (const p of plans) nameCount.set(p.name, (nameCount.get(p.name) ?? 0) + 1);

  return plans.flatMap((plan): PlanChoice[] => {
    const isCurrent = current !== null && plan.id === current.plan.id;
    const offered: BillingPeriod[] =
      plan.priceYearlyPaise === null ? ['monthly'] : ['monthly', 'yearly'];
    const cycles = isCurrent ? offered.filter((c) => c !== current.billingPeriod) : offered;
    if (cycles.length === 0) return [];
    const base = (nameCount.get(plan.name) ?? 0) > 1 ? `${plan.name} (${plan.code})` : plan.name;
    return [{ plan, label: isCurrent ? `${base} — current plan` : base, cycles, isCurrent }];
  });
}

/** The grace a hospital with an overdue invoice has left. */
export interface GraceNotice {
  readonly invoice: BillingInvoice;
  /** Last day of full access, `yyyy-mm-dd`. */
  readonly endsOn: string;
}

/**
 * While the subscription is past due or in grace: the oldest unpaid invoice
 * already due and the day grace ends — the invoice's own `grace_ends_at`
 * when Medibook set one, else its due date plus the hospital's grace days
 * (D-30 default 7). `null` in any other state (appendix 09 F6).
 */
export function graceNotice(
  sub: Pick<Subscription, 'status' | 'graceDaysOverride'>,
  invoices: readonly BillingInvoice[],
  today: string,
): GraceNotice | null {
  if (!GRACE_STATUSES.has(sub.status)) return null;
  const due = invoices
    .filter((i) => UNPAID_INVOICE_STATUSES.has(i.status) && i.dueAt <= today)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const oldest = due[0];
  if (!oldest) return null;
  return {
    invoice: oldest,
    endsOn:
      oldest.graceEndsAt ?? addDaysISO(oldest.dueAt, sub.graceDaysOverride ?? DEFAULT_GRACE_DAYS),
  };
}
