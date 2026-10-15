import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { appointmentsKeys } from '@/features/appointments/application/queries/appointments.keys';
import {
  mergePush,
  NO_PUSHED_CHANGES,
  refreshPushed,
  refreshQueue,
} from '@/features/token-queue/application/queries/tokenQueue.cache';
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

describe('pushed changes (coalesced refresh)', () => {
  it('merges a burst of pushes into one set of re-reads', () => {
    let changes = NO_PUSHED_CHANGES;
    for (let i = 0; i < 20; i += 1) changes = mergePush(changes, { sessionId: 's1' });
    changes = mergePush(changes, { sessionId: 's2' });
    expect(changes.sessions).toBe(false);
    expect([...changes.callsOf].sort()).toEqual(['s1', 's2']);
    expect(mergePush(changes, 'bookings').sessions).toBe(true);
  });

  it('re-reads the bookings and the pushed sessions’ calls, and the session lists only when a push had no snapshot', () => {
    const client = seeded();
    client.setQueryData(tokenQueueKeys.calls('s1'), []);
    client.setQueryData(tokenQueueKeys.calls('s2'), []);
    refreshPushed(client, mergePush(NO_PUSHED_CHANGES, { sessionId: 's1' }));
    expect(invalidated(client, tokenQueueKeys.sessions())).toBe(false);
    expect(invalidated(client, appointmentsKeys.lists())).toBe(true);
    expect(invalidated(client, appointmentsKeys.detail('a1'))).toBe(true);
    expect(invalidated(client, tokenQueueKeys.calls('s1'))).toBe(true);
    expect(invalidated(client, tokenQueueKeys.calls('s2'))).toBe(false);

    refreshPushed(client, mergePush(NO_PUSHED_CHANGES, 'bookings'));
    expect(invalidated(client, tokenQueueKeys.sessions())).toBe(true);
  });
});
