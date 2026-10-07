import { ifMatch } from '@/core/api/headers';
import { hospitalApi } from '@/core/api/http';

import type { NumberingChanges } from '@/features/settings/domain/entities/settings.entities';
import {
  numberingListResponseSchema,
  numberingPreviewResponseSchema,
  numberingSeriesResponseSchema,
} from '@/features/settings/infrastructure/data-sources/remote/numbering.response';

/** Numbering series (D-25/D-26, O-02): `/hospital/numbering…` (`hospital_settings.*`). */

const NUMBERING_PATH = '/numbering';

function seriesPath(kind: string): string {
  return `${NUMBERING_PATH}/${encodeURIComponent(kind)}`;
}

export async function getNumberingSeries() {
  const response = await hospitalApi.get(NUMBERING_PATH);
  return numberingListResponseSchema.parse(response.data);
}

/** `If-Match` is required (`require_version`); MRN answers 409 `NUMBERING_LOCKED` once used. */
export async function putNumberingSeries(kind: string, changes: NumberingChanges, version: number) {
  const body = {
    ...(changes.format !== undefined && { format: changes.format }),
    ...(changes.prefix !== undefined && { prefix: changes.prefix }),
    ...(changes.separator !== undefined && { separator: changes.separator }),
    ...(changes.padWidth !== undefined && { pad_width: changes.padWidth }),
    ...(changes.reset !== undefined && { reset: changes.reset }),
    ...(changes.fyStartMonth !== undefined && { fy_start_month: changes.fyStartMonth }),
  };
  const response = await hospitalApi.put(seriesPath(kind), body, { headers: ifMatch(version) });
  return numberingSeriesResponseSchema.parse(response.data);
}

/** The next number of the saved series, rendered without allocating it. */
export async function getNumberingPreview(kind: string) {
  const response = await hospitalApi.get(`${seriesPath(kind)}/preview`);
  return numberingPreviewResponseSchema.parse(response.data);
}
