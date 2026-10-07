import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { appointmentsKeys } from '@/features/appointments/application/queries/appointments.keys';
import { refreshQueue } from '@/features/token-queue/application/queries/tokenQueue.cache';
import { tokenQueueKeys } from '@/features/token-queue/application/queries/tokenQueue.keys';

function seeded(): QueryClient {
  const client = new QueryClient();
  client.setQueryData(tokenQueueKeys.sessions(), []);
  client.setQueryData(appointmentsKeys.lists(), []);
  client.setQueryData(appointmentsKeys.detail('a1'), { id: 'a1' });
  client.setQueryData(appointmentsKeys.events('a1'), []);
  client.setQueryData(appointmentsKeys.receipt('a1'), { id: 'r1' });
  return client;
}

function invalidated(client: QueryClient, key: readonly unknown[]): boolean | undefined {
  return client.getQueryState(key)?.isInvalidated;
}

describe('refreshQueue', () => {
  it('re-reads the sessions, the appointment lists and every open appointment with its history', () => {
    const client = seeded();
    refreshQueue(client);
    expect(invalidated(client, tokenQueueKeys.sessions())).toBe(true);
    expect(invalidated(client, appointmentsKeys.lists())).toBe(true);
    expect(invalidated(client, appointmentsKeys.detail('a1'))).toBe(true);
    expect(invalidated(client, appointmentsKeys.events('a1'))).toBe(true);
  });

  it('leaves what a queue change cannot touch alone (the receipt)', () => {
    const client = seeded();
    refreshQueue(client);
    expect(invalidated(client, appointmentsKeys.receipt('a1'))).toBe(false);
  });
});
