import { ifMatch } from '@/core/api/headers';
import { hospitalApi } from '@/core/api/http';
import { fetchAllPages } from '@/core/api/pagination';

import type { DisplayDeviceChanges } from '@/features/settings/domain/entities/settings.entities';
import {
  displayDevicePageSchema,
  displayDeviceResponseSchema,
  displayDeviceWithKeyResponseSchema,
} from '@/features/settings/infrastructure/data-sources/remote/displayDevices.response';

/** Token display screens: `/hospital/display-devices…` (`display_devices.*`, O-10). */

const DEVICES_PATH = '/display-devices';

function devicePath(id: string): string {
  return `${DEVICES_PATH}/${encodeURIComponent(id)}`;
}

function deviceBody(changes: DisplayDeviceChanges) {
  return {
    ...(changes.name !== undefined && { name: changes.name }),
    ...(changes.isActive !== undefined && { is_active: changes.isActive }),
    ...(changes.selectedDoctorIds !== undefined && {
      selected_doctor_ids: changes.selectedDoctorIds,
    }),
    ...(changes.selectedCounterIds !== undefined && {
      selected_counter_ids: changes.selectedCounterIds,
    }),
  };
}

export async function listDisplayDevices() {
  return fetchAllPages(async (params) => {
    const response = await hospitalApi.get(DEVICES_PATH, { params });
    return displayDevicePageSchema.parse(response.data);
  });
}

/** Answers with the device and its raw key — shown once, never stored by the app. */
export async function postDisplayDevice(name: string) {
  const response = await hospitalApi.post(DEVICES_PATH, { name });
  return displayDeviceWithKeyResponseSchema.parse(response.data);
}

/** `If-Match` is required (`require_version`). */
export async function patchDisplayDevice(
  id: string,
  changes: DisplayDeviceChanges,
  version: number,
) {
  const response = await hospitalApi.patch(devicePath(id), deviceBody(changes), {
    headers: ifMatch(version),
  });
  return displayDeviceResponseSchema.parse(response.data);
}

export async function deleteDisplayDevice(id: string, version: number): Promise<void> {
  await hospitalApi.delete(devicePath(id), { headers: ifMatch(version) });
}

/** The old key stops working at once; the new raw key is returned exactly once. */
export async function postRotateDisplayDeviceKey(id: string) {
  const response = await hospitalApi.post(`${devicePath(id)}/rotate-key`);
  return displayDeviceWithKeyResponseSchema.parse(response.data);
}
