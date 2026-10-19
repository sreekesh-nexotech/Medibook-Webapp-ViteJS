import type { Result } from '@/core/error/failure';

import type { DisplayBoard, DisplayGrant } from '@/features/display/domain/entities/display.types';

/** The waiting-room display surface (`/api/v1/display`). */
export interface DisplayRepository {
  /** Trade the device key for a short-lived display token. */
  signIn(deviceKey: string): Promise<Result<DisplayGrant>>;
  /** Today's queue for this screen's selection. */
  board(accessToken: string): Promise<Result<DisplayBoard>>;
  /** The device key this screen keeps between restarts, if any. */
  storedKey(): string | null;
  rememberKey(deviceKey: string): void;
  forgetKey(): void;
}
