import { useCallback, useEffect, useState } from 'react';

import { STORAGE_KEY_BELL_SEEN_PREFIX } from '@/core/storage/storage.keys';
import { readStorage, writeStorage } from '@/core/storage/webStorage';

/**
 * Which bell items this user has marked read (UAT-68). Kept in
 * `localStorage` per user, so it survives a reload and every tab agrees,
 * until the backend keeps read state itself (DASH-03). An item's key carries
 * its count, so a new booking or drawer makes it unread again.
 */

/** Never let the stored list grow without bound. */
const MAX_SEEN = 50;

function storageKey(scope: string): string {
  return `${STORAGE_KEY_BELL_SEEN_PREFIX}${scope}`;
}

export function parseSeen(raw: string | null): ReadonlySet<string> {
  if (!raw) return new Set();
  try {
    const value: unknown = JSON.parse(raw);
    return new Set(
      Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [],
    );
  } catch {
    // A corrupt entry behaves like an empty one.
    return new Set();
  }
}

export function serialiseSeen(keys: Iterable<string>): string {
  return JSON.stringify(Array.from(keys).slice(-MAX_SEEN));
}

export function useSeenNotifications(scope: string) {
  const [state, setState] = useState(() => ({
    scope,
    seen: parseSeen(readStorage('local', storageKey(scope))),
  }));
  // A different signed-in user reads their own list (derived during render).
  if (state.scope !== scope) {
    setState({ scope, seen: parseSeen(readStorage('local', storageKey(scope))) });
  }

  useEffect(() => {
    const onStorage = (event: StorageEvent): void => {
      if (event.key === storageKey(scope)) setState({ scope, seen: parseSeen(event.newValue) });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [scope]);

  const markAllRead = useCallback(
    (keys: readonly string[]): void => {
      const seen = new Set(keys);
      setState({ scope, seen });
      writeStorage('local', storageKey(scope), serialiseSeen(seen));
    },
    [scope],
  );

  return { seen: state.seen, markAllRead };
}
