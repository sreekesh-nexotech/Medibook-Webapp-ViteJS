import { idempotencyKey } from '@/core/api/headers';
import { hospitalApi } from '@/core/api/http';
import { MAX_PAGE_SIZE } from '@/core/api/pagination';

import type { SlotGridParams } from '@/features/slots/domain/entities/slots.entities';
import type { SlotBulkRequestBody } from '@/features/slots/infrastructure/data-sources/remote/slots.request';
import {
  bulkSlotResponseSchema,
  generationRunPageResponseSchema,
  regenerateResponseSchema,
  slotBlockResponseSchema,
  slotGridPageResponseSchema,
  slotResponseSchema,
} from '@/features/slots/infrastructure/data-sources/remote/slots.response';

/** `/hospital/slots…` (`schema.yml`, `scheduling/routes/hospital_schedule.py`). */

const SLOTS_PATH = '/slots';

/** `?confirm=true` executes a schedule write; without it the backend dry-runs. */
const CONFIRM_PARAMS = { confirm: true } as const;

/** The grid pages by doctor; read the widest page the backend allows. */
export async function getSlotGrid(params: SlotGridParams) {
  const response = await hospitalApi.get(SLOTS_PATH, {
    params: {
      date: params.date,
      department_id: params.departmentId ?? undefined,
      doctor_id: params.doctorId ?? undefined,
      page_size: MAX_PAGE_SIZE,
    },
  });
  return slotGridPageResponseSchema.parse(response.data);
}

/** Idempotency-Key is mandatory here (a confirmed block refunds). */
export async function postSlotBlock(slotId: string, key: string) {
  const response = await hospitalApi.post(
    `${SLOTS_PATH}/${encodeURIComponent(slotId)}/block`,
    { reason: null },
    { headers: idempotencyKey(key) },
  );
  return slotBlockResponseSchema.parse(response.data);
}

export async function postSlotOpen(slotId: string) {
  const response = await hospitalApi.post(`${SLOTS_PATH}/${encodeURIComponent(slotId)}/open`);
  return slotResponseSchema.parse(response.data);
}

/**
 * Dry run unless `confirm`. Every call needs an Idempotency-Key, so a dry run
 * takes a fresh one each time; an execution takes the caller's.
 */
export async function postSlotBulk(body: SlotBulkRequestBody, key: string, confirm: boolean) {
  const response = await hospitalApi.post(`${SLOTS_PATH}/bulk`, body, {
    params: confirm ? CONFIRM_PARAMS : undefined,
    headers: idempotencyKey(key),
  });
  return bulkSlotResponseSchema.parse(response.data);
}

export async function postSlotRegenerate(doctorId: string | null) {
  const response = await hospitalApi.post(`${SLOTS_PATH}/regenerate`, {
    doctor_id: doctorId ?? undefined,
  });
  return regenerateResponseSchema.parse(response.data);
}

/** Newest first (the backend's default sort); one row is enough. */
export async function getLatestGenerationRun() {
  const response = await hospitalApi.get(`${SLOTS_PATH}/generation-runs`, {
    params: { page_size: 1 },
  });
  return generationRunPageResponseSchema.parse(response.data);
}
