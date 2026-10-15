/** Query keys for Plan & Billing (standards §4 — no inline key arrays). */
export const billingKeys = {
  all: ['billing'] as const,
  subscription: () => [...billingKeys.all, 'subscription'] as const,
  usage: () => [...billingKeys.all, 'usage'] as const,
  invoices: (page: number, pageSize: number) =>
    [...billingKeys.all, 'invoices', page, pageSize] as const,
  invoice: (invoiceId: string) => [...billingKeys.all, 'invoice', invoiceId] as const,
  plans: () => [...billingKeys.all, 'plans'] as const,
  planChangeRequests: () => [...billingKeys.all, 'plan-change-requests'] as const,
  creditNotes: () => [...billingKeys.all, 'credit-notes'] as const,
};
