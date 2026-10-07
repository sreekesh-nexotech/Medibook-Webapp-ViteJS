/**
 * Idempotency keys per user action (D-21, UAT-16). A key is minted the first
 * time an action is attempted and handed back on every retry of that same
 * action — a resubmitted form, a second click after a timeout — so the
 * backend replays the first answer instead of booking or refunding twice. It
 * is dropped only once the action succeeded; the next action gets a new one.
 *
 * Scopes name the action and its target, e.g. `check-in:<appointment id>` or
 * `book`. Pure: no React (see `useActionKeys`).
 */
export interface ActionKeys {
  /** The key for this action: the same one until `settle` is called. */
  readonly keyFor: (scope: string) => string;
  /** The action succeeded; its next attempt is a new action with a new key. */
  readonly settle: (scope: string) => void;
}

export function createActionKeys(mint: () => string): ActionKeys {
  const keys = new Map<string, string>();
  return {
    keyFor: (scope) => {
      const existing = keys.get(scope);
      if (existing) return existing;
      const key = mint();
      keys.set(scope, key);
      return key;
    },
    settle: (scope) => {
      keys.delete(scope);
    },
  };
}
