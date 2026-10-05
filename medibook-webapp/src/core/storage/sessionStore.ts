/**
 * Thin `sessionStorage` wrapper. Storage can be unavailable (private mode,
 * blocked site data, quota) and the accessor itself can throw; every call
 * here degrades to "nothing stored" instead of crashing the app — the
 * caller's fallback is always "sign in again".
 */

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    // Accessing sessionStorage throws when site data is blocked — treat as absent.
    return null;
  }
}

export function readSession(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    // Unreadable storage behaves like an empty one.
    return null;
  }
}

export function writeSession(key: string, value: string): void {
  try {
    storage()?.setItem(key, value);
  } catch {
    // Quota or blocked storage: the value lives in memory only for this page.
  }
}

export function removeSession(key: string): void {
  try {
    storage()?.removeItem(key);
  } catch {
    // Nothing to remove from storage that cannot be opened.
  }
}
