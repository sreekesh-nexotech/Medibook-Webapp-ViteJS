import { z } from 'zod';

import type {
  NumberingSeries,
  TokenPolicy,
} from '@/features/ops-hospitals/domain/entities/hospitalSettings.entity';

/** `NumberingSeriesSerializer` (`hospitals/serializers/settings_numbering_serializer.py`). */
export const numberingSeriesResponseSchema = z.object({
  kind: z.string(),
  format: z.string(),
  prefix: z.string().nullable(),
  reset: z.string(),
  fy_start_month: z.number().int(),
  gapless: z.boolean(),
  editable_by: z.string(),
  locked: z.boolean(),
  has_allocated: z.boolean(),
  next_preview: z.string(),
  warning: z.string(),
  version: z.number().int(),
});

export type NumberingSeriesResponse = z.infer<typeof numberingSeriesResponseSchema>;

export function toNumberingSeries(dto: NumberingSeriesResponse): NumberingSeries {
  return {
    kind: dto.kind,
    format: dto.format,
    prefix: dto.prefix,
    reset: dto.reset,
    fyStartMonth: dto.fy_start_month,
    gapless: dto.gapless,
    editableBy: dto.editable_by,
    locked: dto.locked,
    hasAllocated: dto.has_allocated,
    nextPreview: dto.next_preview,
    warning: dto.warning,
    version: dto.version,
  };
}

/** `TokenPolicySerializer` (`tokens/serializers/policy_serializer.py`). */
export const tokenPolicyResponseSchema = z.object({
  scope: z.string(),
  reset: z.string(),
  format: z.string(),
  prefix: z.string(),
  online_marker: z.string(),
  offline_marker: z.string(),
  separate_ranges: z.boolean(),
  online_range_start: z.number().int().nullable(),
  online_range_end: z.number().int().nullable(),
  offline_range_start: z.number().int().nullable(),
  offline_range_end: z.number().int().nullable(),
  reuse_cancelled: z.boolean(),
  pending: z
    .object({
      scope: z.string().nullable().optional(),
      reset: z.string().nullable().optional(),
      effective_date: z.string().nullable().optional(),
    })
    .nullable(),
  version: z.number().int(),
});

export type TokenPolicyResponse = z.infer<typeof tokenPolicyResponseSchema>;

export function toTokenPolicy(dto: TokenPolicyResponse): TokenPolicy {
  return {
    scope: dto.scope,
    reset: dto.reset,
    format: dto.format,
    prefix: dto.prefix,
    onlineMarker: dto.online_marker,
    offlineMarker: dto.offline_marker,
    separateRanges: dto.separate_ranges,
    onlineRangeStart: dto.online_range_start,
    onlineRangeEnd: dto.online_range_end,
    offlineRangeStart: dto.offline_range_start,
    offlineRangeEnd: dto.offline_range_end,
    reuseCancelled: dto.reuse_cancelled,
    pending: dto.pending && {
      scope: dto.pending.scope ?? null,
      reset: dto.pending.reset ?? null,
      effectiveDate: dto.pending.effective_date ?? null,
    },
    version: dto.version,
  };
}
