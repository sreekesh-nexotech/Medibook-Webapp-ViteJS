/** Query keys for the live token queue (standards §4). */
export const tokenQueueKeys = {
  all: ['token-queue'] as const,
  sessions: () => [...tokenQueueKeys.all, 'sessions'] as const,
  sessionsOn: (date: string) => [...tokenQueueKeys.sessions(), date] as const,
};
