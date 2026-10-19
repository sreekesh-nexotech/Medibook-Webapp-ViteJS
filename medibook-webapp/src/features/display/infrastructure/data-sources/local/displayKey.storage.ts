import { STORAGE_KEY_DISPLAY_DEVICE_KEY } from '@/core/storage/storage.keys';
import { readStorage, removeStorage, writeStorage } from '@/core/storage/webStorage';

/** The device key lives with the TV's browser so it signs in again after a restart. */
export function readDisplayKey(): string | null {
  return readStorage('local', STORAGE_KEY_DISPLAY_DEVICE_KEY);
}

export function writeDisplayKey(deviceKey: string): void {
  writeStorage('local', STORAGE_KEY_DISPLAY_DEVICE_KEY, deviceKey);
}

export function removeDisplayKey(): void {
  removeStorage('local', STORAGE_KEY_DISPLAY_DEVICE_KEY);
}
