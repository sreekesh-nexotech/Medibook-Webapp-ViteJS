/**
 * Thin wrapper over `sessionStorage` / `localStorage`. Storage can be
 * unavailable (private mode, blocked site data, quota) and the accessor itself
 * can throw; every call here degrades to "nothing stored" instead of crashing
 * the app — the caller's fallback is always "sign in again".
 */

/** `session` lives as long as the tab; `local` survives closing the browser. */
export type StorageArea = 'session' | 'local';

function storage(area: StorageArea): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return area === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    // Accessing web storage throws when site data is blocked — treat as absent.
    return null;
  }
}

export function readStorage(area: StorageArea, key: string): string | null {
  try {
    return storage(area)?.getItem(key) ?? null;
  } catch {
    // Unreadable storage behaves like an empty one.
    return null;
  }
}

export function writeStorage(area: StorageArea, key: string, value: string): void {
  try {
    storage(area)?.setItem(key, value);
  } catch {
    // Quota or blocked storage: the value lives in memory only for this page.
  }
}

export function removeStorage(area: StorageArea, key: string): void {
  try {
    storage(area)?.removeItem(key);
  } catch {
    // Nothing to remove from storage that cannot be opened.
  }
}
