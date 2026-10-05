import { useQueryClient } from '@tanstack/react-query';

import { complianceKeys } from '@/features/ops-compliance/application/queries/compliance.keys';

/** Refetch every compliance list on screen (the Refresh control). */
export function useRefreshCompliance(): () => Promise<void> {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: complianceKeys.all });
}
