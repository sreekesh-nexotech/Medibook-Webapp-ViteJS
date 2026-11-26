import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { DisplaySelection } from '@/features/settings/domain/entities/settings.entities';
import { settingsKeys } from '@/features/settings/application/queries/settings.keys';
import {
  previewDisplay,
  previewDisplayDevice,
} from '@/features/settings/application/usecases/previewDisplay';

/** The same cadence as the hall screen itself, so the preview stays live while it is open. */
const PREVIEW_REFRESH_MS = 15_000;

/** A saved screen, or the Register / Edit form's unsaved selection. */
export type DisplayPreviewTarget =
  | { readonly kind: 'device'; readonly id: string }
  | { readonly kind: 'draft'; readonly selection: DisplaySelection };

function targetKey(target: DisplayPreviewTarget): string {
  if (target.kind === 'device') return `device:${target.id}`;
  const { departmentId, doctorIds } = target.selection;
  return `draft:${departmentId ?? 'all'}:${[...doctorIds].sort().join(',')}`;
}

/**
 * What a display shows right now (`…/display-devices/preview`, point 8) — read like a query
 * because it writes nothing. `null` stays idle (the preview dialog is closed).
 */
export function useDisplayPreviewQuery(target: DisplayPreviewTarget | null) {
  return useQuery({
    queryKey: settingsKeys.displayPreview(target ? targetKey(target) : 'none'),
    queryFn: async () =>
      unwrap(
        await (target?.kind === 'device'
          ? previewDisplayDevice(target.id)
          : previewDisplay(
              target?.kind === 'draft' ? target.selection : { departmentId: null, doctorIds: [] },
            )),
      ),
    enabled: target !== null,
    refetchInterval: PREVIEW_REFRESH_MS,
    staleTime: 0,
  });
}
