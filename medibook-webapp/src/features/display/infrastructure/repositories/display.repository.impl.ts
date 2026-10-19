import { attempt } from '@/core/error/attempt';

import type { DisplayRepository } from '@/features/display/domain/repositories/display.repository';
import {
  readDisplayKey,
  removeDisplayKey,
  writeDisplayKey,
} from '@/features/display/infrastructure/data-sources/local/displayKey.storage';
import {
  getDisplayQueue,
  postDisplayAuth,
} from '@/features/display/infrastructure/data-sources/remote/display.api';
import {
  toDisplayBoard,
  toDisplayGrant,
} from '@/features/display/infrastructure/data-sources/remote/display.response';

export const displayRepository: DisplayRepository = {
  signIn: (deviceKey) => attempt(async () => toDisplayGrant(await postDisplayAuth(deviceKey))),
  board: (accessToken) => attempt(async () => toDisplayBoard(await getDisplayQueue(accessToken))),
  storedKey: readDisplayKey,
  rememberKey: writeDisplayKey,
  forgetKey: removeDisplayKey,
};
