import { ifMatch } from '@/core/api/headers';
import { hospitalApi } from '@/core/api/http';
import { fetchAllPages } from '@/core/api/pagination';

import { displayQueueResponseSchema } from '@/features/display/infrastructure/data-sources/remote/display.response';
import type {
  DisplayDeviceChanges,
  DisplayDeviceInput,
  DisplaySelection,
} from '@/features/settings/domain/entities/settings.entities';
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
    ...(changes.selectedDepartmentId !== undefined && {
      selected_department_id: changes.selectedDepartmentId,
    }),
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
export async function postDisplayDevice(input: DisplayDeviceInput) {
  const response = await hospitalApi.post(DEVICES_PATH, {
    name: input.name,
    selected_department_id: input.selection.departmentId,
    selected_doctor_ids: input.selection.doctorIds,
  });
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

/**
 * What a screen with this (unsaved) selection shows right now — the same body as the screen's own
 * `GET /display/queue`. Writes nothing (`POST` only because it carries the form's selection).
 */
export async function postDisplayPreview(selection: DisplaySelection) {
  const response = await hospitalApi.post(`${DEVICES_PATH}/preview`, {
    selected_department_id: selection.departmentId,
    selected_doctor_ids: selection.doctorIds,
  });
  return displayQueueResponseSchema.parse(response.data);
}

/** What this saved screen shows right now, without its key. */
export async function getDisplayDevicePreview(id: string) {
  const response = await hospitalApi.get(`${devicePath(id)}/preview`);
  return displayQueueResponseSchema.parse(response.data);
}

/** The old key stops working at once; the new raw key is returned exactly once. */
export async function postRotateDisplayDeviceKey(id: string) {
  const response = await hospitalApi.post(`${devicePath(id)}/rotate-key`);
  return displayDeviceWithKeyResponseSchema.parse(response.data);
}
