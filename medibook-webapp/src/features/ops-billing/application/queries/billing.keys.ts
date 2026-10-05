import type {
  InvoiceListParams,
  PaymentListParams,
  PlanChangeListParams,
} from '@/features/ops-billing/domain/entities/billing.entities';

/** Query keys for ops subscription billing (standards §4 — no inline key arrays). */
export const billingKeys = {
  all: ['ops-billing'] as const,
  invoices: (params: InvoiceListParams) => [...billingKeys.all, 'invoices', params] as const,
  invoice: (id: string) => [...billingKeys.all, 'invoice', id] as const,
  reminders: (invoiceId: string) => [...billingKeys.all, 'reminders', invoiceId] as const,
  payments: (params: PaymentListParams) => [...billingKeys.all, 'payments', params] as const,
  subscription: (id: string) => [...billingKeys.all, 'subscription', id] as const,
  planChanges: (params: PlanChangeListParams) =>
    [...billingKeys.all, 'plan-changes', params] as const,
};
