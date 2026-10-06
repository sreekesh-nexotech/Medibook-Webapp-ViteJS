/**
 * Recovery from a redeploy (checklist RUN-01). Screens load lazily, so a tab
 * opened before a deploy asks for code files the new deploy no longer has.
 * React.lazy remembers that failure, so retrying the screen fails forever;
 * reloading fetches the new index.html and its new file names.
 */

/** When the app last reloaded itself for a new build (per tab). */
const RELOADED_AT_KEY = 'medibook.stale-build.reloaded-at';

/** At most one automatic reload in this window, so a file that is really missing cannot loop. */
const RELOAD_WINDOW_MS = 30_000;

/** Browser messages for a dynamic import that could not be fetched. */
const CHUNK_LOAD_ERROR =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i;

function lastReloadAt(): number {
  try {
    return Number(window.sessionStorage.getItem(RELOADED_AT_KEY) ?? 0);
  } catch {
    // Storage blocked (private mode, policy): treat as never reloaded.
    return 0;
  }
}

function rememberReload(): void {
  try {
    window.sessionStorage.setItem(RELOADED_AT_KEY, String(Date.now()));
  } catch {
    // Storage blocked: the reload still happens, only the loop guard is lost.
  }
}

/** Whether `error` means a screen's code file could not be loaded. */
export function isStaleBuildError(error: unknown): boolean {
  return error instanceof Error && CHUNK_LOAD_ERROR.test(error.message);
}

/**
 * Reload once to pick up the current build. Returns `false` without
 * reloading when it already did so moments ago.
 */
export function reloadForNewBuild(): boolean {
  if (Date.now() - lastReloadAt() < RELOAD_WINDOW_MS) return false;
  rememberReload();
  window.location.reload();
  return true;
}

/**
 * Vite fires `vite:preloadError` when a dynamic import fails to load
 * (https://vite.dev/guide/build#load-error-handling). Reload once instead of
 * leaving the screen broken.
 */
export function recoverFromStaleBuilds(): void {
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadForNewBuild()) event.preventDefault();
  });
}
