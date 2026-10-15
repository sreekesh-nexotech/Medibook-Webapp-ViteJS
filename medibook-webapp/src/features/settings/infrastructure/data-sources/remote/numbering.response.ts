import { z } from 'zod';

import type { NumberingSeries } from '@/features/settings/domain/entities/settings.entities';

/** `NumberingSeriesSerializer` (`GET /hospital/numbering`, `GET/PUT …/{kind}`). */
export const numberingSeriesResponseSchema = z.object({
  kind: z.string(),
  format: z.string(),
  prefix: z.string().nullable(),
  separator: z.string().nullable(),
  pad_width: z.number().int(),
  reset: z.string(),
  fy_start_month: z.number().int(),
  gapless: z.boolean(),
  editable_by: z.string(),
  locked: z.boolean(),
  has_allocated: z.boolean(),
  next_preview: z.string(),
  version: z.number().int(),
  warning: z.string(),
});

/** The list answers `{results: [...]}` without paging fields. */
export const numberingListResponseSchema = z.object({
  results: z.array(numberingSeriesResponseSchema),
});

/** `GET /hospital/numbering/{kind}/preview` — allocates nothing. */
export const numberingPreviewResponseSchema = z.object({
  kind: z.string(),
  next_number: z.string(),
});

export type NumberingSeriesResponse = z.infer<typeof numberingSeriesResponseSchema>;

export function toNumberingSeries(dto: NumberingSeriesResponse): NumberingSeries {
  return {
    kind: dto.kind,
    format: dto.format,
    prefix: dto.prefix,
    separator: dto.separator,
    padWidth: dto.pad_width,
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
