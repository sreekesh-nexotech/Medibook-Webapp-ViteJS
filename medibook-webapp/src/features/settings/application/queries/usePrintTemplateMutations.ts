import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { PrintTemplateInput } from '@/features/settings/domain/entities/settings.entities';
import { settingsKeys } from '@/features/settings/application/queries/settings.keys';
import { createPrintTemplate } from '@/features/settings/application/usecases/createPrintTemplate';
import { deletePrintTemplate } from '@/features/settings/application/usecases/deletePrintTemplate';
import { updatePrintTemplate } from '@/features/settings/application/usecases/updatePrintTemplate';

interface SavePrintTemplateInput {
  readonly existing?: { readonly id: string; readonly version: number };
  readonly input: PrintTemplateInput;
}

/** Create or edit a template; making one the default clears the old default of its kind. */
export function useSavePrintTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ existing, input }: SavePrintTemplateInput) => {
      if (!existing) return unwrap(await createPrintTemplate(input));
      const { kind: _fixedKind, ...changes } = input;
      return unwrap(await updatePrintTemplate(existing.id, changes, existing.version));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: settingsKeys.printTemplates() }),
  });
}

/** Refused (409) for a kind's default or the token policy's template. */
export function useDeletePrintTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deletePrintTemplate(id)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: settingsKeys.printTemplates() }),
  });
}
