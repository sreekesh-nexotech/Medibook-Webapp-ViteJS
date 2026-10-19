import { displayRepository } from '@/features/display/infrastructure/repositories/display.repository.impl';

/** The device key this screen signed in with last time, if any. */
export function storedDisplayKey(): string | null {
  return displayRepository.storedKey();
}

export function rememberDisplayKey(deviceKey: string): void {
  displayRepository.rememberKey(deviceKey);
}

export function forgetDisplayKey(): void {
  displayRepository.forgetKey();
}
