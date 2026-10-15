import type { ApiSurface } from '@/core/api/surface';
import { STORAGE_KEY_LAST_ACTIVITY } from '@/core/storage/storage.keys';
import { readStorage, writeStorage } from '@/core/storage/webStorage';

/**
 * The user's last real input (keyboard, mouse, touch), shared by every tab of
 * this browser per surface (UAT-04).
 *
 * The idle sign-out is broadcast to all tabs, so it must only fire when *all*
 * of them are idle: a desk running the token queue in one tab and
 * Appointments in another is working, even if the queue tab sees no input.
 * Each tab writes its activity to `localStorage` (throttled) and hears the
 * others through the `storage` event.
 *
 * The same clock marks background traffic: a GET made while the user has
 * been idle for a while is a poll, not a user action, and is sent with
 * `X-Medibook-Activity: background` so it does not keep the server-side
 * session alive (BE-21, SEC-01-B).
 */

/** Write the shared timestamp at most this often while the user types or scrolls. */
const WRITE_THROTTLE_MS = 2_000;

/** A request made this long after the last input is background traffic (a poll). */
export const BACKGROUND_AFTER_MS = 15_000;

type ActivityListener = (origin: 'local' | 'remote') => void;

/** Loading or reloading the page is the user acting, so it starts the clock. */
const loadedAt = Date.now();
const lastSeen: Record<ApiSurface, number> = { hospital: loadedAt, platform: loadedAt };
const lastWrite: Record<ApiSurface, number> = { hospital: 0, platform: 0 };
const listeners: Record<ApiSurface, Set<ActivityListener>> = {
  hospital: new Set(),
  platform: new Set(),
};

const SURFACES: readonly ApiSurface[] = ['hospital', 'platform'];

function notify(surface: ApiSurface, origin: 'local' | 'remote'): void {
  for (const listener of listeners[surface]) listener(origin);
}

function storedActivity(surface: ApiSurface): number {
  const value = Number(readStorage('local', STORAGE_KEY_LAST_ACTIVITY[surface]));
  return Number.isFinite(value) ? value : 0;
}

/**
 * Record input in this tab. `force` writes through the throttle — for an
 * explicit "Stay signed in", which the other tabs must hear at once.
 */
export function recordActivity(
  surface: ApiSurface,
  { force = false, now = Date.now() }: { force?: boolean; now?: number } = {},
): void {
  lastSeen[surface] = Math.max(lastSeen[surface], now);
  if (force || now - lastWrite[surface] >= WRITE_THROTTLE_MS) {
    lastWrite[surface] = now;
    writeStorage('local', STORAGE_KEY_LAST_ACTIVITY[surface], String(lastSeen[surface]));
  }
  notify(surface, 'local');
}

/** Epoch ms of the latest input in any tab on `surface` (0 when none is known). */
export function lastActivityAt(surface: ApiSurface): number {
  return Math.max(lastSeen[surface], storedActivity(surface));
}

/** Hear activity from this tab and the others; returns the unsubscribe. */
export function subscribeActivity(surface: ApiSurface, listener: ActivityListener): () => void {
  listeners[surface].add(listener);
  return () => {
    listeners[surface].delete(listener);
  };
}

/** Whether a request on `surface` right now is background traffic (see above). */
export function isBackgroundTraffic(surface: ApiSurface, now: number = Date.now()): boolean {
  return now - lastActivityAt(surface) > BACKGROUND_AFTER_MS;
}

/** Another tab wrote its activity: adopt it and wake this tab's idle timer. */
function onStorage(event: StorageEvent): void {
  const surface = SURFACES.find((s) => STORAGE_KEY_LAST_ACTIVITY[s] === event.key);
  if (!surface || event.newValue === null) return;
  const at = Number(event.newValue);
  if (!Number.isFinite(at) || at <= lastSeen[surface]) return;
  lastSeen[surface] = at;
  notify(surface, 'remote');
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('storage', onStorage);
}
