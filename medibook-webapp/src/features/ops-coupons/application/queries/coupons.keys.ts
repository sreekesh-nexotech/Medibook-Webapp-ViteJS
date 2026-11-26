/** Query keys for Medibook Operations' coupons. */
export const couponsKeys = {
  all: ['ops-coupons'] as const,
  list: () => [...couponsKeys.all, 'list'] as const,
  uses: (id: string) => [...couponsKeys.all, 'uses', id] as const,
};
