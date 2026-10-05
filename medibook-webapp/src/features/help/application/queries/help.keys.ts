/** Query keys for Help & Support (standards §4 — no inline key arrays). */
export const helpKeys = {
  all: ['help'] as const,
  /** The hospital's tickets (`GET /hospital/support/tickets`, no screen yet). */
  tickets: () => [...helpKeys.all, 'tickets'] as const,
};
