import { isAxiosError } from 'axios';
import { z } from 'zod';

/**
 * Helpers for list endpoints whose filters are being rolled out on the
 * backend. Every list view validates its query against an allowlist
 * (`core/filters.py` `FilterSpec.apply`) and answers an unknown parameter with
 * `400 VALIDATION_ERROR` and `errors: {<param>: ["Unknown query parameter."]}`.
 * A caller that sends an announced-but-not-yet-deployed filter can recognise
 * that answer and retry the old way, so the screen keeps working against
 * either backend.
 */

const HTTP_BAD_REQUEST = 400;

const unknownParamBodySchema = z.object({
  errors: z.record(z.string(), z.unknown()),
});

/** True when the server refused `param` as an unknown query parameter. */
export function isUnknownQueryParam(error: unknown, param: string): boolean {
  if (!isAxiosError(error) || error.response?.status !== HTTP_BAD_REQUEST) return false;
  const parsed = unknownParamBodySchema.safeParse(error.response.data);
  return parsed.success && Object.hasOwn(parsed.data.errors, param);
}

/**
 * Run `withParam`; if the server does not know `param` yet, run `without`
 * instead. Any other failure propagates unchanged.
 */
export async function withQueryParamFallback<T>(
  param: string,
  withParam: () => Promise<T>,
  without: () => Promise<T>,
): Promise<T> {
  try {
    return await withParam();
  } catch (error) {
    if (isUnknownQueryParam(error, param)) return without();
    throw error;
  }
}
