import { ifMatch } from '@/core/api/headers';
import { hospitalApi } from '@/core/api/http';
import { fetchAllPages } from '@/core/api/pagination';

import type { CounterInput } from '@/features/settings/domain/entities/settings.entities';
import {
  counterResponseSchema,
  settingsCounterPageSchema,
} from '@/features/settings/infrastructure/data-sources/remote/counters.response';

/** Front-desk counters: `/hospital/counters…` (`hospital_settings.view/add/edit/del`). */

const COUNTERS_PATH = '/counters';

function counterPath(id: string): string {
  return `${COUNTERS_PATH}/${encodeURIComponent(id)}`;
}

function counterBody(input: Partial<CounterInput>) {
  return {
    ...(input.code !== undefined && { code: input.code }),
    ...(input.name !== undefined && { name: input.name }),
    ...(input.isActive !== undefined && { is_active: input.isActive }),
  };
}

export async function listSettingsCounters() {
  return fetchAllPages(async (params) => {
    const response = await hospitalApi.get(COUNTERS_PATH, { params });
    return settingsCounterPageSchema.parse(response.data);
  });
}

export async function postCounter(input: CounterInput) {
  const response = await hospitalApi.post(COUNTERS_PATH, counterBody(input));
  return counterResponseSchema.parse(response.data);
}

/** `update_counter` calls `require_version`: `If-Match` is mandatory. */
export async function patchCounter(id: string, changes: Partial<CounterInput>, version: number) {
  const response = await hospitalApi.patch(counterPath(id), counterBody(changes), {
    headers: ifMatch(version),
  });
  return counterResponseSchema.parse(response.data);
}

export async function deleteCounter(id: string, version: number): Promise<void> {
  await hospitalApi.delete(counterPath(id), { headers: ifMatch(version) });
}
