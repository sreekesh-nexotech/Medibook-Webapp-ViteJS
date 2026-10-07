import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type { Counter } from '@/features/settings/domain/entities/settings.entities';

/** `HospitalCounterSerializer` (`/hospital/counters`). */
export const counterResponseSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  is_active: z.boolean(),
  version: z.number().int(),
});

export const settingsCounterPageSchema = paginatedSchema(counterResponseSchema);

export function toCounter(dto: z.infer<typeof counterResponseSchema>): Counter {
  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    isActive: dto.is_active,
    version: dto.version,
  };
}
