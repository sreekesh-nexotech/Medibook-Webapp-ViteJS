import { IDEMPOTENCY_KEY_HEADER, IF_MATCH_HEADER } from '@/core/config/api';

/**
 * Per-request headers the backend's write contract uses. Spread into an Axios
 * call's `headers`:
 *
 * ```ts
 * hospitalApi.patch(`/doctors/${id}`, body, { headers: ifMatch(doctor.version) });
 * hospitalApi.post('/appointments', body, { headers: idempotencyKey() });
 * ```
 */

/** Optimistic concurrency: the row version you edited; a stale one gets a 409/412. */
export function ifMatch(version: number): Readonly<Record<string, string>> {
  return { [IF_MATCH_HEADER]: `"${version}"` };
}

/**
 * A fresh replay key for a declared-idempotent write. Generate it once per
 * user intent (e.g. when the form opens), not per retry, so a retried submit
 * is deduplicated instead of performed twice.
 */
export function idempotencyKey(
  key: string = crypto.randomUUID(),
): Readonly<Record<string, string>> {
  return { [IDEMPOTENCY_KEY_HEADER]: key };
}
