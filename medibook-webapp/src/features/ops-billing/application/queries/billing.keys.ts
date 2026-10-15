import type { QueryClient } from '@tanstack/react-query';

import type {
  BillingPeriod,
  DunningListParams,
  InvoiceListParams,
  PaymentListParams,
  PlanChangeListParams,
  SubscriptionListParams,
} from '@/features/ops-billing/domain/entities/billing.entities';
import { hospitalsKeys } from '@/features/ops-hospitals/application/queries/hospitals.keys';
import { plansKeys } from '@/features/ops-plans/application/queries/plans.keys';

/** Query keys for ops subscription billing (standards §4 — no inline key arrays). */
export const billingKeys = {
  all: ['ops-billing'] as const,
  invoices: (params: InvoiceListParams) => [...billingKeys.all, 'invoices', params] as const,
  invoice: (id: string) => [...billingKeys.all, 'invoice', id] as const,
  reminders: (invoiceId: string) => [...billingKeys.all, 'reminders', invoiceId] as const,
  payments: (params: PaymentListParams) => [...billingKeys.all, 'payments', params] as const,
  payment: (id: string) => [...billingKeys.all, 'payment', id] as const,
  subscription: (id: string) => [...billingKeys.all, 'subscription', id] as const,
  subscriptions: (params: SubscriptionListParams) =>
    [...billingKeys.all, 'subscriptions', params] as const,
  subscriptionPreview: (id: string, planId: string | null, period: BillingPeriod | null) =>
    [...billingKeys.all, 'subscription-preview', id, planId, period] as const,
  planChanges: (params: PlanChangeListParams) =>
    [...billingKeys.all, 'plan-changes', params] as const,
  planChangePreview: (id: string) => [...billingKeys.all, 'plan-change-preview', id] as const,
  dunning: (params: DunningListParams) => [...billingKeys.all, 'dunning', params] as const,
  summary: () => [...billingKeys.all, 'summary'] as const,
};

/**
 * After a billing write that can change a hospital's plan or standing
 * (approve a plan change, change a subscription, mark paid, void, grace):
 * billing, the plan catalogue's subscriber counts and the hospital pages
 * (subscription, read-only state) are all re-read (UAT-57, 11·F3, F15, F21).
 */
export function invalidateAfterBillingChange(queryClient: QueryClient): Promise<unknown> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: billingKeys.all }),
    queryClient.invalidateQueries({ queryKey: plansKeys.all }),
    queryClient.invalidateQueries({ queryKey: hospitalsKeys.all }),
  ]);
}
