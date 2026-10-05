/** Query keys for the ops reports screen. */
export const opsReportsKeys = {
  all: ['ops-reports'] as const,
  list: () => [...opsReportsKeys.all, 'list'] as const,
};
