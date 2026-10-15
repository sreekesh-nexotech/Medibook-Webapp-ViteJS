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

/** A new replay key. Mint it once per user action, never per HTTP call (UAT-16). */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

/**
 * The replay header for a declared-idempotent write. Pass the key minted once
 * per user intent (e.g. when the form opens) and reuse it on retry, so a
 * retried submit is deduplicated instead of performed twice. The backend
 * stores only successful answers, so after an error the same key may be sent
 * again (`core/idempotency.py`).
 */
export function idempotencyKey(
  key: string = newIdempotencyKey(),
): Readonly<Record<string, string>> {
  return { [IDEMPOTENCY_KEY_HEADER]: key };
}
