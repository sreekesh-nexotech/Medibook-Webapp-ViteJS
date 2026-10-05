import type { Result } from '@/core/error/failure';
import { err, ok } from '@/core/error/failure';
import { toFailure } from '@/core/error/toFailure';

/**
 * Run an infrastructure call and turn whatever it throws (Axios error, Zod
 * error, …) into a typed `Failure`. Repository implementations wrap each
 * remote call in this so nothing raw escapes upward:
 *
 * ```ts
 * getOrders: () => attempt(async () => toOrders(await ordersApi.list())),
 * ```
 */
export async function attempt<T>(run: () => Promise<T>): Promise<Result<T>> {
  try {
    return ok(await run());
  } catch (error) {
    return err(toFailure(error));
  }
}
