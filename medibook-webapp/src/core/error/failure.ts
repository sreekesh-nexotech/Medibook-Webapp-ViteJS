/**
 * Errors as values (standards §6). Infrastructure converts every failure into
 * one of these kinds via `toFailure()`; repositories return `Result<T>` and
 * never throw raw Axios errors upward.
 */

/** Field → messages, as the backend's `errors` object carries them. */
export type FieldErrors = Readonly<Record<string, readonly string[]>>;

export type FailureKind =
  /** No response at all: offline, DNS, CORS, timeout. */
  | 'network'
  /** 400 — the request was understood but rejected; see `fieldErrors`. */
  | 'validation'
  /** 401 — missing, expired or revoked credentials (after any refresh attempt). */
  | 'unauthorized'
  /** 403 — authenticated but not allowed (RBAC, suspended or read-only hospital). */
  | 'forbidden'
  /** 404 */
  | 'notFound'
  /** 409 / 412 — state or version conflict, file in use, duplicate. */
  | 'conflict'
  /** 423 / 429 — locked out or rate limited; retry later. */
  | 'rateLimited'
  /**
   * 501 — the server doesn't offer this yet: a feature that is off or not
   * built in this phase, or PDFs on a server without the renderer (PRD-09).
   */
  | 'unavailable'
  /** Any other 5xx — the server failed. */
  | 'server'
  /** A 2xx response whose body did not match the expected schema. */
  | 'parse'
  /** Anything else. */
  | 'unknown';

export interface Failure {
  readonly kind: FailureKind;
  /** User-safe sentence for a toast or an error state. */
  readonly message: string;
  /** Backend error code (`VALIDATION_ERROR`, `FILE_IN_USE`, …) when the server sent one. */
  readonly code: string | null;
  /** HTTP status, or `null` when no response arrived. */
  readonly status: number | null;
  /** Per-field validation messages (400 only; empty otherwise). */
  readonly fieldErrors: FieldErrors;
  /** Backend `request_id`, for support tickets and logs. */
  readonly requestId: string | null;
  /** Backend `meta` (e.g. `{ max_bytes }` for `FILE_TOO_LARGE`). */
  readonly meta: Readonly<Record<string, unknown>>;
}

export type Result<T> =
  { readonly ok: true; readonly data: T } | { readonly ok: false; readonly failure: Failure };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function err<T>(failure: Failure): Result<T> {
  return { ok: false, failure };
}

/**
 * Bridge from `Result` to TanStack Query: query/mutation functions must throw
 * to enter the error state, so they unwrap here and the thrown value is the
 * typed `Failure` (read it back with `isFailure`).
 */
export function unwrap<T>(result: Result<T>): T {
  if (result.ok) return result.data;
  throw result.failure;
}

export function isFailure(value: unknown): value is Failure {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    'message' in value &&
    'fieldErrors' in value
  );
}
