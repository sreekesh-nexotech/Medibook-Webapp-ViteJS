import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { CounterInput } from '@/features/settings/domain/entities/settings.entities';
import { settingsKeys } from '@/features/settings/application/queries/settings.keys';
import { createCounter } from '@/features/settings/application/usecases/createCounter';
import { deleteCounter } from '@/features/settings/application/usecases/deleteCounter';
import { updateCounter } from '@/features/settings/application/usecases/updateCounter';
import { usersRolesKeys } from '@/features/users-roles/application/queries/usersRoles.keys';

/** Users & Roles lists counters too (default counter per staff member). */
function invalidateCounters(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: settingsKeys.counters() });
  void queryClient.invalidateQueries({ queryKey: usersRolesKeys.counters() });
}

interface SaveCounterInput {
  /** Absent → create; present → update at the version being edited. */
  readonly existing?: { readonly id: string; readonly version: number };
  readonly input: CounterInput;
}

export function useSaveCounterMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ existing, input }: SaveCounterInput) =>
      unwrap(
        await (existing
          ? updateCounter(existing.id, input, existing.version)
          : createCounter(input)),
      ),
    onSettled: () => invalidateCounters(queryClient),
  });
}

interface DeleteCounterInput {
  readonly id: string;
  readonly version: number;
}

/** Soft delete: past receipts keep their counter. */
export function useDeleteCounterMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, version }: DeleteCounterInput) =>
      unwrap(await deleteCounter(id, version)),
    onSettled: () => invalidateCounters(queryClient),
  });
}
