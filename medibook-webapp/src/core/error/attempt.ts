import type { Result } from '@/core/error/failure';
import { err, ok } from '@/core/error/failure';
import { reportFailure } from '@/core/error/monitoring';
import { toFailure } from '@/core/error/toFailure';

/**
 * Run an infrastructure call and turn whatever it throws (Axios error, Zod
 * error, …) into a typed `Failure`. Repository implementations wrap each
 * remote call in this so nothing raw escapes upward. Server errors and
 * unreadable responses are also reported to monitoring here (OBS-01):
 *
 * ```ts
 * getOrders: () => attempt(async () => toOrders(await ordersApi.list())),
 * ```
 */
export async function attempt<T>(run: () => Promise<T>): Promise<Result<T>> {
  try {
    return ok(await run());
  } catch (error) {
    const failure = toFailure(error);
    reportFailure(failure, error);
    return err(failure);
  }
}
