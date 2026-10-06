import { STORAGE_ORIGIN } from '@/core/config/env';

/** A development file store on this machine may use plain http. */
const LOCAL_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);

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
