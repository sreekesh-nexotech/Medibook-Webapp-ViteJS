import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { invalidateOnboarding } from '@/features/ops-hospitals/application/queries/onboarding.keys';

/**
 * Re-read the whole pipeline: the list, the open case (checklist, blockers,
 * administrator) and the hospital it belongs to (10·F20).
 */
export function useRefreshOnboarding() {
  const queryClient = useQueryClient();
  return useCallback(() => invalidateOnboarding(queryClient), [queryClient]);
}
