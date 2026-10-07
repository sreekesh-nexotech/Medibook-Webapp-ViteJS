import { useQueryClient } from '@tanstack/react-query';

import { refreshTickets } from '@/features/help/application/queries/help.cache';

/** The "Refresh your tickets" control: lists and threads alike. */
export function useRefreshTickets(): () => Promise<void> {
  const queryClient = useQueryClient();
  return () => refreshTickets(queryClient);
}
