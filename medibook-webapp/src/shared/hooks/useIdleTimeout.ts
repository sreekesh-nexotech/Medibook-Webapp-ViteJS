import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Idle session timeout — audit 3.7.5: "The session-timeout setting in the
 * operations console has nothing behind it. It is a dropdown bound to a value,
 * with no timer and no automatic sign-out."
 *
 * Watches for real user activity, warns `warningSeconds` before the deadline,
 * and calls `onTimeout` when the deadline passes. Activity listeners are
 * deliberately **muted while the warning is showing**, so drifting a mouse
 * across the screen cannot silently extend a session — the user has to answer
 * the warning ("Stay signed in" -> `stayActive()`).
 */

/** Events that count as "the user is still here". */
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'wheel', 'touchstart'] as const;

const MS_PER_MINUTE = 60_000;
const DEFAULT_WARNING_SECONDS = 60;
/** How often the warning countdown re-renders. */
const TICK_MS = 1000;

export interface UseIdleTimeoutOptions {
  /** Total idle minutes before sign-out. `0` (or a non-finite value) disables it. */
  minutes: number;
  /** Called when the idle deadline passes without a `stayActive()`. */
  onTimeout: () => void;
  /** How long the warning shows before sign-out. Default 60s. */
  warningSeconds?: number;
  /** Turn the whole timer off (e.g. while signed out). Default `true`. */
  enabled?: boolean;
}

export interface UseIdleTimeoutResult {
  /** True inside the warning window — render the "still there?" dialog. */
  warning: boolean;
  /** Whole seconds left before sign-out (0 outside the warning window). */
  secondsLeft: number;
  /** Dismiss the warning and restart the idle clock from zero. */
  stayActive: () => void;
}

/**
 * One countdown, tagged with the timer generation that produced it. A change
 * of generation (new timeout setting, `enabled` flip, or `stayActive()`)
 * resets the countdown during render instead of in an effect.
 */
interface CountdownPhase {
  readonly generation: string;
  readonly warning: boolean;
  readonly secondsLeft: number;
}

export function useIdleTimeout({
  minutes,
  onTimeout,
  warningSeconds = DEFAULT_WARNING_SECONDS,
  enabled = true,
}: UseIdleTimeoutOptions): UseIdleTimeoutResult {
  // Latest callback without restarting the timers on every render.
  const onTimeoutRef = useRef(onTimeout);
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  /** Bumped by `stayActive()` to force the timer effect to start over. */
  const [restartCount, setRestartCount] = useState(0);

  const totalMs = Number.isFinite(minutes) && minutes > 0 ? minutes * MS_PER_MINUTE : 0;
  const warnMs = Math.min(warningSeconds * TICK_MS, totalMs);
  const active = enabled && totalMs > 0;
  const generation = `${active}:${totalMs}:${warnMs}:${restartCount}`;

  const [phase, setPhase] = useState<CountdownPhase>({
    generation,
    warning: false,
    secondsLeft: 0,
  });
  if (phase.generation !== generation) {
    setPhase({ generation, warning: false, secondsLeft: 0 });
  }

  const stayActive = useCallback((): void => setRestartCount((n) => n + 1), []);

  useEffect(() => {
    if (!active) return;

    let warnTimer: ReturnType<typeof setTimeout>;
    let outTimer: ReturnType<typeof setTimeout>;
    let tick: ReturnType<typeof setInterval> | undefined;
    let warned = false;

    const clearAll = (): void => {
      clearTimeout(warnTimer);
      clearTimeout(outTimer);
      if (tick !== undefined) clearInterval(tick);
    };

    const schedule = (): void => {
      clearAll();
      warned = false;
      warnTimer = setTimeout(() => {
        warned = true;
        let left = Math.round(warnMs / TICK_MS);
        setPhase({ generation, warning: true, secondsLeft: left });
        tick = setInterval(() => {
          left -= 1;
          setPhase({ generation, warning: true, secondsLeft: left > 0 ? left : 0 });
        }, TICK_MS);
      }, totalMs - warnMs);
      outTimer = setTimeout(() => {
        clearAll();
        onTimeoutRef.current();
      }, totalMs);
    };

    const onActivity = (): void => {
      // Once warned, only an explicit `stayActive()` resets the clock.
      if (!warned) schedule();
    };

    schedule();
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, onActivity, { passive: true });
    }
    return () => {
      clearAll();
      for (const evt of ACTIVITY_EVENTS) window.removeEventListener(evt, onActivity);
    };
  }, [active, totalMs, warnMs, generation]);

  const isWarning = active && phase.warning;
  return {
    warning: isWarning,
    secondsLeft: isWarning ? phase.secondsLeft : 0,
    stayActive,
  };
}
