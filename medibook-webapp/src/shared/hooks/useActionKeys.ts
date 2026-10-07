import { useState } from 'react';

import { newIdempotencyKey } from '@/core/api/headers';
import { createActionKeys, type ActionKeys } from '@/shared/lib/actionKeys';

/**
 * Per-component idempotency keys, one per user action, reused across that
 * action's retries (UAT-16). Keys live as long as the component: closing a
 * form or modal ends its pending actions.
 *
 * ```ts
 * const keys = useActionKeys();
 * const key = keys.keyFor(`check-in:${appt.id}`);
 * checkIn.mutate({ id: appt.id, idempotencyKey: key }, { onSuccess: () => keys.settle(...) });
 * ```
 */
export function useActionKeys(): ActionKeys {
  const [keys] = useState(() => createActionKeys(newIdempotencyKey));
  return keys;
}
