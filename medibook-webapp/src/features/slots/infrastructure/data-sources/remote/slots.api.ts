import { idempotencyKey } from '@/core/api/headers';
import { hospitalApi } from '@/core/api/http';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/core/api/pagination';

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

/** Query parameter carrying the dry run's preview token on confirm (BE-33). */
export const PREVIEW_TOKEN_PARAM = 'preview_token';

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
 * takes a fresh one each time; an execution takes the caller's (one per
 * confirmation) and echoes the dry run's preview token when it had one.
 */
export async function postSlotBulk(
  body: SlotBulkRequestBody,
  key: string,
  confirm: boolean,
  previewToken: string | null = null,
) {
  const response = await hospitalApi.post(`${SLOTS_PATH}/bulk`, body, {
    params: confirm
      ? { confirm: true, ...(previewToken ? { [PREVIEW_TOKEN_PARAM]: previewToken } : {}) }
      : undefined,
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

/** One page of runs, newest first; `doctor_id` narrows to one doctor's runs. */
export async function getGenerationRuns(doctorId: string | null, page: number) {
  const response = await hospitalApi.get(`${SLOTS_PATH}/generation-runs`, {
    params: { page, page_size: DEFAULT_PAGE_SIZE, doctor_id: doctorId ?? undefined },
  });
  return generationRunPageResponseSchema.parse(response.data);
}
