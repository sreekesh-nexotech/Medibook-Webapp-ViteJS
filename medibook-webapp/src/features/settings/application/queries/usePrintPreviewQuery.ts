import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { settingsKeys } from '@/features/settings/application/queries/settings.keys';
import { previewPrintTemplate } from '@/features/settings/application/usecases/previewPrintTemplate';

/**
 * A template rendered with sample data (`POST …/{id}/preview` — it renders,
 * writes nothing, so it is read like a query), keyed by version so an edit
 * re-renders it. `null` id stays idle.
 */
export function usePrintPreviewQuery(template: { id: string; version: number } | null) {
  return useQuery({
    queryKey: settingsKeys.printPreview(template?.id ?? '', template?.version ?? 0),
    queryFn: async () => unwrap(await previewPrintTemplate(template?.id ?? '')),
    enabled: template !== null,
  });
}
