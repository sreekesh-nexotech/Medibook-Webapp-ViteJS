import { create } from 'zustand';

/** Toast flavours the prototype's `window.toast(msg, type)` accepted. */
export type ToastType = 'success' | 'info' | 'error';

export interface ToastItem {
  readonly id: number;
  readonly msg: string;
  readonly type: ToastType;
}

/**
 * How long a toast stays on screen. The prototype's 2.8 s was too short to
 * read an error (UAT-76, 01·F34): confirmations stay 5 s, errors 8 s.
 */
export const TOAST_DURATION_MS: Readonly<Record<ToastType, number>> = {
  success: 5000,
  info: 5000,
  error: 8000,
};

interface ToastState {
  items: readonly ToastItem[];
}

interface ToastActions {
  show: (msg: string, type: ToastType) => void;
}

/** Monotonic id — replaces the prototype's `Date.now() + Math.random()`. */
let toastSeq = 0;

export const useToastStore = create<ToastState & ToastActions>()((set) => ({
  items: [],
  show: (msg, type) => {
    toastSeq += 1;
    const id = toastSeq;
    set((s) => ({ items: [...s.items, { id, msg, type }] }));
    setTimeout(() => {
      set((s) => ({ items: s.items.filter((x) => x.id !== id) }));
    }, TOAST_DURATION_MS[type]);
  },
}));

/**
 * Drop-in replacement for the prototype's global `window.toast(msg, type)` —
 * store actions and components call this exactly where the design fired it.
 * The toast auto-dismisses (5 s, errors 8 s) and is announced by screen
 * readers through the host's live regions.
 */
export function toast(msg: string, type: ToastType = 'success'): void {
  useToastStore.getState().show(msg, type);
}
