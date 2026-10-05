/** Query keys for the subscription-plan catalog. */
export const plansKeys = {
  all: ['ops-plans'] as const,
  list: () => [...plansKeys.all, 'list'] as const,
  subscriberCounts: () => [...plansKeys.all, 'subscriber-count'] as const,
  subscriberCount: (planId: string) => [...plansKeys.subscriberCounts(), planId] as const,
};
