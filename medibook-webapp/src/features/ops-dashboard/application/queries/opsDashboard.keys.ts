/** Query keys for the ops dashboard (standards §4 — no inline key arrays). */
export const opsDashboardKeys = {
  all: ['ops-dashboard'] as const,
  summary: () => [...opsDashboardKeys.all, 'summary'] as const,
};
