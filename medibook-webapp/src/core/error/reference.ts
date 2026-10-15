import { isFailure } from '@/core/error/failure';

/** How much of an id a user reads out; the backend logs the whole id. */
const REFERENCE_LENGTH = 8;

/** The short form of an id that support searches for (`1a2b3c4d`). */
export function shortReference(id: string): string {
  return id.slice(0, REFERENCE_LENGTH);
}

/**
 * The reference to show beside a failure (OBS-04): the start of the request id
 * the backend logged it under, or `null` when no request was involved.
 */
export function referenceOf(error: unknown): string | null {
  return isFailure(error) && error.requestId ? shortReference(error.requestId) : null;
}
