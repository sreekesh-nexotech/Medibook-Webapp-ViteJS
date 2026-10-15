import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { refreshAfterRefund } from '@/features/payments/application/queries/payments.cache';
import { paymentsKeys } from '@/features/payments/application/queries/payments.keys';

describe('refreshAfterRefund', () => {
  it('re-reads a page whose first read was still in flight when the refund settled (C-4)', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const key = [...paymentsKeys.pages(), { q: 'LKSB-2610-00138' }];
    let calls = 0;
    let answerStale: (rows: string) => void = () => undefined;
    const queryFn = (): Promise<string> => {
      calls += 1;
      if (calls === 1) {
        // Sent just before the refund committed: answered from the pre-refund rows.
        return new Promise<string>((resolve) => {
          answerStale = resolve;
        });
      }
      return Promise.resolve('refunded');
    };
    const observer = new QueryObserver(client, { queryKey: key, queryFn });
    const unsubscribe = observer.subscribe(() => undefined);

    await refreshAfterRefund(client);
    answerStale('paid');

    await vi.waitFor(() => expect(client.getQueryData(key)).toBe('refunded'));
    expect(calls).toBe(2);
    unsubscribe();
  });
});
