import { STORAGE_ORIGIN } from '@/core/config/env';
import { clientFailure } from '@/core/error/toFailure';

/** A development file store on this machine may use plain http. */
const LOCAL_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Hosts under `.local` never resolve for a user's browser. A server running
 * without real file storage (`PROVIDERS_MODE=fake`) signs its links on
 * `storage.fake.local` (UB-02).
 */
const PLACEHOLDER_HOST_SUFFIX = '.local';

/** Code on the failure below, so a screen can tell it apart if it needs to. */
export const FILE_STORE_NOT_READY_CODE = 'FILE_STORE_NOT_READY';

/** What the user is told instead of opening a link that cannot load. */
export const FILE_STORE_NOT_READY_MESSAGE =
  'Downloading files is coming soon — this server is not set up to provide them yet.';

/**
 * Whether a signed file link points where the app's files live (SEC-15):
 * https, and on the configured file store when one is configured. The server
 * signs these links, but the browser is about to send a file to, or open,
 * whatever it says, so it is checked first.
 */
export function isFileStoreUrl(raw: string, storageOrigin: string = STORAGE_ORIGIN): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    // Not an absolute URL, so not a file-store link.
    return false;
  }
  const secure =
    url.protocol === 'https:' || (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname));
  if (!secure) return false;
  return storageOrigin === '' || url.origin === storageOrigin;
}

/**
 * Whether a signed file link points at a placeholder store that cannot serve
 * anything (see `PLACEHOLDER_HOST_SUFFIX`). Opening one only shows the user a
 * dead tab, so callers refuse it with `assertFileStoreReady` first.
 */
export function isPlaceholderFileUrl(raw: string): boolean {
  try {
    return new URL(raw).hostname.endsWith(PLACEHOLDER_HOST_SUFFIX);
  } catch {
    // Not an absolute URL: `isFileStoreUrl` is the check that refuses it.
    return false;
  }
}

/**
 * Throw an `unavailable` failure carrying `FILE_STORE_NOT_READY_MESSAGE` when
 * the server handed out a placeholder link, so the screen's existing error
 * toast says downloads are coming soon instead of opening a page that never
 * loads.
 */
export function assertFileStoreReady(raw: string): void {
  if (isPlaceholderFileUrl(raw)) {
    throw clientFailure('unavailable', FILE_STORE_NOT_READY_MESSAGE, FILE_STORE_NOT_READY_CODE);
  }
}
