/**
 * Run a task at most once per window. The first `run()` runs it at once;
 * every `run()` during the window collapses into a single run when the
 * window ends, which opens the next window — so a sustained burst runs the
 * task once per window and a lone call is never delayed. `cancel()` drops a
 * pending run (call it when the owner unmounts).
 */
export interface Coalescer {
  readonly run: () => void;
  readonly cancel: () => void;
}

export function createCoalescer(task: () => void, windowMs: number): Coalescer {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let isQueued = false;

  const endWindow = (): void => {
    if (!isQueued) {
      timer = null;
      return;
    }
    isQueued = false;
    task();
    timer = setTimeout(endWindow, windowMs);
  };

  return {
    run: () => {
      if (timer !== null) {
        isQueued = true;
        return;
      }
      task();
      timer = setTimeout(endWindow, windowMs);
    },
    cancel: () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      isQueued = false;
    },
  };
}
