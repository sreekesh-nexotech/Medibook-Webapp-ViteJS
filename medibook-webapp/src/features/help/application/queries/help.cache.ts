import type { QueryClient } from '@tanstack/react-query';

import { helpKeys } from '@/features/help/application/queries/help.keys';

/**
 * Re-read the hospital's tickets — the lists and every thread already read —
 * so a reply the Medibook team sent meanwhile shows when a ticket is opened
 * again, not only its row in the list (UAT R-13).
 */
export function refreshTickets(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: helpKeys.tickets() });
}
