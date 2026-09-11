import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

/**
 * Unsaved-changes guard — audit 3.7.1. The operations settings screen already
 * proves the pattern (a sticky "Unsaved changes" bar with Discard/Save); this
 * hook is that pattern's missing half: nothing that actually *stops* the edit
 * from being thrown away.
 *
 * It covers all three ways edits get lost:
 *  1. Closing / reloading the tab      -> `beforeunload`.
 *  2. Navigating to another route      -> React Router's `useBlocker`, exposed
 *     as `blocked` + `discard()` / `keepEditing()` so the screen can render a
 *     real design-system `ConfirmModal` instead of a browser dialog.
 *  3. Switching a section tab *within* one screen (the hospital settings case,
 *     which drops edits today) -> the imperative `confirmDiscard()`.
 *
 * Pair it with `shared/ui/UnsavedBar` for the visible half.
 */

const DEFAULT_MESSAGE = 'You have unsaved changes. Discard them?';

export interface UseUnsavedChangesOptions {
  /** True while the screen holds edits that are not persisted yet. */
  dirty: boolean;
  /** Copy for the imperative `confirmDiscard()` prompt. */
  message?: string;
  /** Block in-app route navigation. Default `true`. */
  blockNavigation?: boolean;
  /** Warn on tab close / reload. Default `true`. */
  warnOnUnload?: boolean;
}

export interface UseUnsavedChangesResult {
  /** True while a route navigation is held, waiting for the user to decide. */
  blocked: boolean;
  /** Let the held navigation through, abandoning the edits. */
  discard: () => void;
  /** Cancel the held navigation and stay on the screen. */
  keepEditing: () => void;
  /**
   * Guard an in-page transition (a section tab, a wizard step) that React
   * Router never sees. Returns `true` when it is safe to proceed — i.e. there
   * is nothing dirty, or the user confirmed the discard. Synchronous by
   * necessity: a tab handler has to decide before it switches.
   */
  confirmDiscard: () => boolean;
}

export function useUnsavedChanges({
  dirty,
  message = DEFAULT_MESSAGE,
  blockNavigation = true,
  warnOnUnload = true,
}: UseUnsavedChangesOptions): UseUnsavedChangesResult {
  const blocker = useBlocker(blockNavigation && dirty);

  useEffect(() => {
    if (!warnOnUnload || !dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent): void => {
      // Browsers show their own generic copy; a non-empty returnValue is the
      // only supported way to ask for the prompt at all.
      e.preventDefault();
      e.returnValue = message;
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty, message, warnOnUnload]);

  // A blocker left "blocked" after the screen stops being dirty (e.g. the user
  // saved) would wedge navigation — release it.
  useEffect(() => {
    if (!dirty && blocker.state === 'blocked') blocker.reset();
  }, [dirty, blocker]);

  return {
    blocked: blocker.state === 'blocked',
    discard: () => {
      if (blocker.state === 'blocked') blocker.proceed();
    },
    keepEditing: () => {
      if (blocker.state === 'blocked') blocker.reset();
    },
    confirmDiscard: () => (dirty ? window.confirm(message) : true),
  };
}
