import { useCallback, useEffect, useRef, useState } from 'react';

import { lastActivityAt, recordActivity, subscribeActivity } from '@/core/api/activity';
import type { ApiSurface } from '@/core/api/surface';

/**
 * Idle session timeout — audit 3.7.5, UAT-04.
 *
 * Watches for real user activity **in every tab of this browser** (shared
 * through `core/api/activity`), warns `warningSeconds` before the deadline,
 * and calls `onTimeout` only when no tab has seen input for the whole limit.
 * The sign-out is broadcast to every tab, so a tab that sees no input itself
 * (a token queue left open beside Appointments) must not end the session
 * while the user works elsewhere.
 *
 * This tab's own input is deliberately **muted while the warning is
 * showing**, so drifting a mouse across the screen cannot silently extend a
 * session — the user has to answer the warning ("Stay signed in" →
 * `stayActive()`). Input in another tab still dismisses the warning: the user
 * is demonstrably at the keyboard.
 */

/** Events that count as "the user is still here". */
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'wheel', 'touchstart'] as const;

const MS_PER_MINUTE = 60_000;
const MS_PER_SECOND = 1000;
const DEFAULT_WARNING_SECONDS = 60;
/** How often the warning countdown re-renders. */
const TICK_MS = 1000;

export interface UseIdleTimeoutOptions {
  /** Total idle minutes before sign-out. `0` (or a non-finite value) disables it. */
  minutes: number;
  /** Whose activity clock to follow (each surface has its own server session). */
  surface: ApiSurface;
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

/** Where an idle clock stands at `now`. */
export type IdlePhase =
  | { readonly phase: 'active'; readonly warnInMs: number }
  | { readonly phase: 'warning'; readonly expireInMs: number }
  | { readonly phase: 'expired' };

/**
 * Pure idle-clock arithmetic: given the last input anywhere, the limit and
 * the warning window, where are we now?
 */
export function idlePhase(
  lastActivity: number,
  totalMs: number,
  warnMs: number,
  now: number,
): IdlePhase {
  const deadline = lastActivity + totalMs;
  if (now >= deadline) return { phase: 'expired' };
  const warnAt = deadline - warnMs;
  if (now >= warnAt) return { phase: 'warning', expireInMs: deadline - now };
  return { phase: 'active', warnInMs: warnAt - now };
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
  surface,
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
  const warnMs = Math.min(warningSeconds * MS_PER_SECOND, totalMs);
  const active = enabled && totalMs > 0;
  const generation = `${surface}:${active}:${totalMs}:${warnMs}:${restartCount}`;

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

    let timer: ReturnType<typeof setTimeout> | undefined;
    let tick: ReturnType<typeof setInterval> | undefined;
    let warned = false;

    const clearAll = (): void => {
      if (timer !== undefined) clearTimeout(timer);
      if (tick !== undefined) clearInterval(tick);
      timer = undefined;
      tick = undefined;
    };

    const showCountdown = (expireInMs: number): void => {
      const render = (msLeft: number) =>
        setPhase({
          generation,
          warning: true,
          secondsLeft: Math.max(0, Math.ceil(msLeft / MS_PER_SECOND)),
        });
      const deadline = Date.now() + expireInMs;
      render(expireInMs);
      tick = setInterval(() => render(deadline - Date.now()), TICK_MS);
    };

    /** Re-read the shared clock and arm the next timer from it. */
    const evaluate = (): void => {
      clearAll();
      const now = Date.now();
      const state = idlePhase(lastActivityAt(surface), totalMs, warnMs, now);
      if (state.phase === 'expired') {
        onTimeoutRef.current();
        return;
      }
      if (state.phase === 'active') {
        if (warned) {
          warned = false;
          setPhase({ generation, warning: false, secondsLeft: 0 });
        }
        timer = setTimeout(evaluate, state.warnInMs);
        return;
      }
      warned = true;
      showCountdown(state.expireInMs);
      // At the deadline, check once more: another tab may have been used.
      timer = setTimeout(evaluate, state.expireInMs);
    };

    const onInput = (): void => {
      // Once warned, only an explicit `stayActive()` resets this tab's clock.
      if (!warned) recordActivity(surface);
    };

    // Opening the shell, or answering the warning, is activity every tab hears.
    recordActivity(surface, { force: true });
    evaluate();
    const unsubscribe = subscribeActivity(surface, (origin) => {
      // Local input is ignored while warned (see above); input in another
      // tab always re-arms the clock and dismisses the warning.
      if (origin === 'remote' || !warned) evaluate();
    });
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, onInput, { passive: true });
    }
    return () => {
      clearAll();
      unsubscribe();
      for (const evt of ACTIVITY_EVENTS) window.removeEventListener(evt, onInput);
    };
  }, [active, surface, totalMs, warnMs, generation]);

  const isWarning = active && phase.warning;
  return {
    warning: isWarning,
    secondsLeft: isWarning ? phase.secondsLeft : 0,
    stayActive,
  };
}
