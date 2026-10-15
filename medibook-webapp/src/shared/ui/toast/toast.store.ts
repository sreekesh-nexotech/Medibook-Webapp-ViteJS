import { create } from 'zustand';

import { referenceOf } from '@/core/error/reference';

/** Toast flavours the prototype's `window.toast(msg, type)` accepted. */
export type ToastType = 'success' | 'info' | 'error';

export interface ToastItem {
  readonly id: number;
  readonly msg: string;
  readonly type: ToastType;
  /** Support reference of the failed request behind an error toast (OBS-04). */
  readonly reference: string | null;
}

/**
 * How long a toast stays on screen (UAT-76, A11Y-03, 01·F34): confirmations stay 5 s, errors 8 s.
 */
export const TOAST_DURATION_MS: Readonly<Record<ToastType, number>> = {
  success: 5000,
  info: 5000,
  error: 8000,
};

/** Error toasts stay until dismissed or timeout; past this many, the oldest goes. */
const MAX_ERROR_TOASTS = 3;

interface ToastState {
  items: readonly ToastItem[];
}

interface ToastActions {
  show: (msg: string, type: ToastType, reference: string | null) => void;
  dismiss: (id: number) => void;
}

/** Monotonic id — replaces the prototype's `Date.now() + Math.random()`. */
let toastSeq = 0;

export const useToastStore = create<ToastState & ToastActions>()((set) => ({
  items: [],
  show: (msg, type, reference) => {
    toastSeq += 1;
    const id = toastSeq;
    set((s) => {
      const items = [...s.items, { id, msg, type, reference }];
      const errors = items.filter((t) => t.type === 'error');
      const drop = new Set(errors.slice(0, -MAX_ERROR_TOASTS).map((t) => t.id));
      return { items: items.filter((t) => !drop.has(t.id)) };
    });
    setTimeout(() => {
      set((s) => ({ items: s.items.filter((x) => x.id !== id) }));
    }, TOAST_DURATION_MS[type]);
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
}));

/**
 * Drop-in replacement for the prototype's global `window.toast(msg, type)` —
 * store actions and components call this exactly where the design fired it.
 * The toast auto-dismisses (5 s, errors 8 s) and is announced by screen
 * readers through the host's live regions. For an error, pass what failed as `cause`:
 * a failed request adds its support reference.
 */
export function toast(msg: string, type: ToastType = 'success', cause?: unknown): void {
  useToastStore.getState().show(msg, type, type === 'error' ? referenceOf(cause) : null);
}
