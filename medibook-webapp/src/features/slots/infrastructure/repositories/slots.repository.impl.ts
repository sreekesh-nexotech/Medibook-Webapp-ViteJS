import { attempt } from '@/core/error/attempt';
import { clientFailure } from '@/core/error/toFailure';

import type { SlotsRepository } from '@/features/slots/domain/repositories/slots.repository';
import {
  getGenerationRuns,
  getLatestGenerationRun,
  getSlotGrid,
  postSlotBlock,
  postSlotBulk,
  postSlotOpen,
  postSlotRegenerate,
} from '@/features/slots/infrastructure/data-sources/remote/slots.api';
import { toSlotBulkRequestBody } from '@/features/slots/infrastructure/data-sources/remote/slots.request';
import {
  toBulkSlotResult,
  toDoctorSlotDay,
  toGenerationRun,
  toRegenerateResult,
  toScheduledSlot,
} from '@/features/slots/infrastructure/data-sources/remote/slots.response';

const SLOT_TAKEN = 'This slot was booked a moment ago, so it was not blocked. Refresh the grid.';

export const slotsRepository: SlotsRepository = {
  getSlotGrid: (params) =>
    attempt(async () => {
      const page = await getSlotGrid(params);
      return { days: page.results.map(toDoctorSlotDay), total: page.total };
    }),

  // Without `confirm`, a slot booked since the grid loaded comes back as a
  // dry run (nothing blocked); the grid never cancels a booking one slot at a
  // time, so that is a conflict for the caller.
  blockSlot: (slotId, key) =>
    attempt(async () => {
      const out = await postSlotBlock(slotId, key);
      if (out.dry_run) throw clientFailure('conflict', SLOT_TAKEN);
      return toScheduledSlot(out.slot);
    }),

  openSlot: (slotId) => attempt(async () => toScheduledSlot(await postSlotOpen(slotId))),

  previewBulk: (request) =>
    attempt(async () =>
      toBulkSlotResult(
        await postSlotBulk(toSlotBulkRequestBody(request), crypto.randomUUID(), false),
      ),
    ),

  applyBulk: (request, key, previewToken) =>
    attempt(async () =>
      toBulkSlotResult(await postSlotBulk(toSlotBulkRequestBody(request), key, true, previewToken)),
    ),

  regenerate: (doctorId) =>
    attempt(async () => toRegenerateResult(await postSlotRegenerate(doctorId))),

  getLatestGenerationRun: () =>
    attempt(async () => {
      const [latest] = (await getLatestGenerationRun()).results;
      return latest ? toGenerationRun(latest) : null;
    }),

  listGenerationRuns: (doctorId, page) =>
    attempt(async () => {
      const dto = await getGenerationRuns(doctorId, page);
      return { items: dto.results.map(toGenerationRun), total: dto.total, hasNext: dto.has_next };
    }),
};
