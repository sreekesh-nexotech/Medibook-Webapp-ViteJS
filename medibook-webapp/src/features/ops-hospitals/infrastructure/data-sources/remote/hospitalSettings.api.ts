import { ifMatch } from '@/core/api/headers';
import { platformApi } from '@/core/api/http';

import type {
  NumberingChange,
  NumberingKind,
  TokenPolicyChange,
} from '@/features/ops-hospitals/domain/entities/hospitalSettings.entity';
import type {
  NumberingSeriesResponse,
  TokenPolicyResponse,
} from '@/features/ops-hospitals/infrastructure/data-sources/remote/hospitalSettings.response';
import {
  numberingSeriesResponseSchema,
  tokenPolicyResponseSchema,
} from '@/features/ops-hospitals/infrastructure/data-sources/remote/hospitalSettings.response';

/** Platform overrides of a hospital's numbering and token policy (`hospitals.edit`, even to read). */

function hospitalPath(id: string): string {
  return `/hospitals/${encodeURIComponent(id)}`;
}

/** `GET /platform/hospitals/{id}/numbering/{kind}`. */
export async function getNumbering(
  id: string,
  kind: NumberingKind,
): Promise<NumberingSeriesResponse> {
  const response = await platformApi.get(`${hospitalPath(id)}/numbering/${kind}`);
  return numberingSeriesResponseSchema.parse(response.data);
}

/** `PUT /platform/hospitals/{id}/numbering/{kind}` (`If-Match`). Omitted fields keep their value. */
export async function putNumbering(
  id: string,
  kind: NumberingKind,
  change: NumberingChange,
  version: number,
): Promise<NumberingSeriesResponse> {
  const response = await platformApi.put(
    `${hospitalPath(id)}/numbering/${kind}`,
    {
      ...(change.format !== undefined && { format: change.format }),
      ...(change.prefix !== undefined && { prefix: change.prefix }),
      ...(change.reset !== undefined && { reset: change.reset }),
      ...(change.editableBy !== undefined && { editable_by: change.editableBy }),
    },
    { headers: ifMatch(version) },
  );
  return numberingSeriesResponseSchema.parse(response.data);
}

/** `GET /platform/hospitals/{id}/token-policy`. */
export async function getTokenPolicy(id: string): Promise<TokenPolicyResponse> {
  const response = await platformApi.get(`${hospitalPath(id)}/token-policy`);
  return tokenPolicyResponseSchema.parse(response.data);
}

/**
 * `PUT /platform/hospitals/{id}/token-policy` (`If-Match`). `scope` and
 * `reset` apply from tomorrow (hospital-local); everything else applies now.
 */
export async function putTokenPolicy(
  id: string,
  change: TokenPolicyChange,
  version: number,
): Promise<TokenPolicyResponse> {
  const response = await platformApi.put(
    `${hospitalPath(id)}/token-policy`,
    {
      ...(change.scope !== undefined && { scope: change.scope }),
      ...(change.reset !== undefined && { reset: change.reset }),
      ...(change.format !== undefined && { format: change.format }),
      ...(change.prefix !== undefined && { prefix: change.prefix }),
      ...(change.onlineMarker !== undefined && { online_marker: change.onlineMarker }),
      ...(change.offlineMarker !== undefined && { offline_marker: change.offlineMarker }),
      ...(change.reuseCancelled !== undefined && { reuse_cancelled: change.reuseCancelled }),
      ...(change.separateRanges !== undefined && { separate_ranges: change.separateRanges }),
      ...(change.onlineRangeStart !== undefined && {
        online_range_start: change.onlineRangeStart,
      }),
      ...(change.onlineRangeEnd !== undefined && { online_range_end: change.onlineRangeEnd }),
      ...(change.offlineRangeStart !== undefined && {
        offline_range_start: change.offlineRangeStart,
      }),
      ...(change.offlineRangeEnd !== undefined && { offline_range_end: change.offlineRangeEnd }),
    },
    { headers: ifMatch(version) },
  );
  return tokenPolicyResponseSchema.parse(response.data);
}
