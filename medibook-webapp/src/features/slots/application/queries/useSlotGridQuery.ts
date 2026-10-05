import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { SlotGridParams } from '@/features/slots/domain/entities/slots.entities';
import { SLOT_GRID_STALE_TIME_MS } from '@/features/slots/application/queries/slots.config';
import { slotsKeys } from '@/features/slots/application/queries/slots.keys';
import { fetchSlotGrid } from '@/features/slots/application/usecases/fetchSlotGrid';

/** The slot grid for one date: every matching doctor → sessions → slots. */
export function useSlotGridQuery(params: SlotGridParams) {
  return useQuery({
    queryKey: slotsKeys.grid(params),
    queryFn: async () => unwrap(await fetchSlotGrid(params)),
    placeholderData: keepPreviousData,
    staleTime: SLOT_GRID_STALE_TIME_MS,
  });
}
