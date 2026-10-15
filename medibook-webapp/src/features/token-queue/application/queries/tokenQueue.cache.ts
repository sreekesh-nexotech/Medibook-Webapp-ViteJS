import type { QueryClient } from '@tanstack/react-query';

import type { QueueSession } from '@/features/token-queue/domain/entities/tokenQueue.entities';
import { appointmentsKeys } from '@/features/appointments/application/queries/appointments.keys';
import { tokenQueueKeys } from '@/features/token-queue/application/queries/tokenQueue.keys';

/**
 * Put a fresh session snapshot into every cached session list, keeping the
 * newer version when a push and a command answer race. Local only: no request.
 */
export function putSession(queryClient: QueryClient, session: QueueSession): void {
  queryClient.setQueriesData<readonly QueueSession[]>(
    { queryKey: tokenQueueKeys.sessions() },
    (rows) => rows?.map((s) => (s.id === session.id && session.version >= s.version ? session : s)),
  );
}

/**
 * A command's answer: the session snapshot goes into the cache, then the
 * appointment lists (H7) re-read the statuses the command changed, and the
 * session's call history picks up the new call.
 */
export function applySession(queryClient: QueryClient, session: QueueSession): void {
  putSession(queryClient, session);
  refreshBookings(queryClient);
  void queryClient.invalidateQueries({ queryKey: tokenQueueKeys.calls(session.id) });
}

/** Something about the day's bookings changed without a snapshot (a booking or a cancel). */
export function refreshQueue(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: tokenQueueKeys.sessions() });
  refreshBookings(queryClient);
}

/** What a run of server pushes asks to re-read, merged until the next refresh. */
export interface PushedChanges {
  /** A push came without a usable snapshot: the session lists re-read. */
  readonly sessions: boolean;
  /** Sessions whose snapshot was pushed: their call histories re-read. */
  readonly callsOf: ReadonlySet<string>;
}

export const NO_PUSHED_CHANGES: PushedChanges = { sessions: false, callsOf: new Set() };

/** Add one push to the changes waiting for the next refresh. */
export function mergePush(
  changes: PushedChanges,
  push: { readonly sessionId: string } | 'bookings',
): PushedChanges {
  if (push === 'bookings') return { ...changes, sessions: true };
  return { ...changes, callsOf: new Set([...changes.callsOf, push.sessionId]) };
}

/**
 * One refresh for every push since the last one (the snapshots themselves
 * went into the cache as they arrived, `putSession`): each query re-reads
 * once however many pushes asked for it.
 */
export function refreshPushed(queryClient: QueryClient, changes: PushedChanges): void {
  if (changes.sessions) {
    void queryClient.invalidateQueries({ queryKey: tokenQueueKeys.sessions() });
  }
  refreshBookings(queryClient);
  for (const sessionId of changes.callsOf) {
    void queryClient.invalidateQueries({ queryKey: tokenQueueKeys.calls(sessionId) });
  }
}

/**
 * A queue change moves bookings on (called, with the doctor, done, no-show):
 * the lists re-read their statuses, and so does an open appointment drawer
 * with its history — a token called on Token Management offers No-show in
 * the drawer straight away (UAT R-10).
 */
function refreshBookings(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: appointmentsKeys.lists() });
  void queryClient.invalidateQueries({ queryKey: appointmentsKeys.details() });
  void queryClient.invalidateQueries({ queryKey: appointmentsKeys.eventLists() });
}
