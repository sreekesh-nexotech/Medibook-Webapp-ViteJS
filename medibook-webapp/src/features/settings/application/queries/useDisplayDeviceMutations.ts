import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { DisplayDeviceChanges } from '@/features/settings/domain/entities/settings.entities';
import { settingsKeys } from '@/features/settings/application/queries/settings.keys';
import { createDisplayDevice } from '@/features/settings/application/usecases/createDisplayDevice';
import { deleteDisplayDevice } from '@/features/settings/application/usecases/deleteDisplayDevice';
import { rotateDisplayDeviceKey } from '@/features/settings/application/usecases/rotateDisplayDeviceKey';
import { updateDisplayDevice } from '@/features/settings/application/usecases/updateDisplayDevice';

/** Register a screen. The answer carries its raw key — show it once; it is never cached. */
export function useRegisterDisplayDeviceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => unwrap(await createDisplayDevice(name)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: settingsKeys.displayDevices() }),
  });
}

interface UpdateDisplayDeviceInput {
  readonly id: string;
  readonly changes: DisplayDeviceChanges;
  readonly version: number;
}

/** Rename, deactivate or reactivate a screen. */
export function useUpdateDisplayDeviceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, changes, version }: UpdateDisplayDeviceInput) =>
      unwrap(await updateDisplayDevice(id, changes, version)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: settingsKeys.displayDevices() }),
  });
}

interface DeleteDisplayDeviceInput {
  readonly id: string;
  readonly version: number;
}

export function useDeleteDisplayDeviceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, version }: DeleteDisplayDeviceInput) =>
      unwrap(await deleteDisplayDevice(id, version)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: settingsKeys.displayDevices() }),
  });
}

/** Issue a new key; the old one stops working at once. */
export function useRotateDisplayDeviceKeyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await rotateDisplayDeviceKey(id)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: settingsKeys.displayDevices() }),
  });
}
