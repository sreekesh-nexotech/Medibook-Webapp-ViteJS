import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type {
  DisplayDevice,
  DisplayDeviceWithKey,
} from '@/features/settings/domain/entities/settings.entities';

/** `DisplayDeviceSerializer` (`/hospital/display-devices`, O-10). The key hash is never sent. */
export const displayDeviceResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  is_active: z.boolean(),
  selected_doctor_ids: z.array(z.string()).optional(),
  selected_counter_ids: z.array(z.string()).optional(),
  last_seen_at: z.string().nullable().optional(),
  version: z.number().int(),
});

export const displayDevicePageSchema = paginatedSchema(displayDeviceResponseSchema);

/** Register / rotate-key: the raw key appears exactly once. */
export const displayDeviceWithKeyResponseSchema = z.object({
  device: displayDeviceResponseSchema,
  device_key: z.string(),
});

export function toDisplayDevice(dto: z.infer<typeof displayDeviceResponseSchema>): DisplayDevice {
  return {
    id: dto.id,
    name: dto.name,
    isActive: dto.is_active,
    selectedDoctorIds: dto.selected_doctor_ids ?? [],
    selectedCounterIds: dto.selected_counter_ids ?? [],
    lastSeenAt: dto.last_seen_at ?? null,
    version: dto.version,
  };
}

export function toDisplayDeviceWithKey(
  dto: z.infer<typeof displayDeviceWithKeyResponseSchema>,
): DisplayDeviceWithKey {
  return { device: toDisplayDevice(dto.device), deviceKey: dto.device_key };
}
