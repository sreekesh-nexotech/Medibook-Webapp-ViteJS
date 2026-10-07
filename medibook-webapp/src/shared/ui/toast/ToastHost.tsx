import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/Icon';
import type { IconName } from '@/shared/ui/icon-registry';

import { useToastStore, type ToastType } from './toast.store';

/** Pill tint + glyph per toast type (the prototype's `tints` map). */
const TOAST_TINTS: Record<ToastType, { bg: string; icon: IconName }> = {
  success: { bg: 'bg-g-600', icon: 'check' },
  info: { bg: 'bg-blue', icon: 'info' },
  error: { bg: 'bg-d-500', icon: 'triangle-alert' },
};

/** One pill, unchanged from the prototype. */
function ToastPill({ msg, type }: { msg: string; type: ToastType }) {
  const s = TOAST_TINTS[type];
  return (
    <div
      className={cn(
        'animate-toast-in text-body shadow-pop flex items-center gap-2.5 rounded-full px-4.5 py-2.75 font-medium text-white',
        s.bg,
      )}
    >
      <Icon name={s.icon} size={17} /> {msg}
    </div>
  );
}

/**
 * Global toast host — fixed bottom-center pill stack, rendered once per
 * shell. Toasts are announced (UAT-76, 01·F34): confirmations through a
 * polite live region, errors through an assertive one. The regions stay
 * mounted so screen readers pick up each new toast.
 */
export function ToastHost() {
  const items = useToastStore((s) => s.items);
  const errors = items.filter((t) => t.type === 'error');
  const notices = items.filter((t) => t.type !== 'error');
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-9999 flex -translate-x-1/2 flex-col items-center gap-2.5">
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-2.5">
        {notices.map((t) => (
          <ToastPill key={t.id} msg={t.msg} type={t.type} />
        ))}
      </div>
      <div role="alert" aria-live="assertive" className="flex flex-col items-center gap-2.5">
        {errors.map((t) => (
          <ToastPill key={t.id} msg={t.msg} type={t.type} />
        ))}
      </div>
    </div>
  );
}
