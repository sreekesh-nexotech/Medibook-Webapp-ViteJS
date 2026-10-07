import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/Icon';
import type { IconName } from '@/shared/ui/icon-registry';

import { useToastStore, type ToastItem, type ToastType } from './toast.store';

/** Pill tint + glyph per toast type (the prototype's `tints` map). */
const TOAST_TINTS: Record<ToastType, { bg: string; icon: IconName }> = {
  success: { bg: 'bg-success', icon: 'check' },
  info: { bg: 'bg-blue', icon: 'info' },
  error: { bg: 'bg-danger', icon: 'triangle-alert' },
};

/**
 * Global toast host — fixed bottom-center pill stack, rendered once per shell.
 * Both groups are live regions that exist before any toast arrives, so screen
 * readers announce each one: errors at once (`role="alert"`), the rest
 * politely (A11Y-03). Errors carry a Dismiss button and stay until used.
 */
export function ToastHost() {
  const items = useToastStore((s) => s.items);
  const dismiss = useToastStore((s) => s.dismiss);
  const errors = items.filter((t) => t.type === 'error');
  const others = items.filter((t) => t.type !== 'error');
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-9999 flex -translate-x-1/2 flex-col items-center gap-2.5">
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-2.5">
        {others.map((t) => (
          <Toast key={t.id} t={t} />
        ))}
      </div>
      <div role="alert" aria-live="assertive" className="flex flex-col items-center gap-2.5">
        {errors.map((t) => (
          <Toast key={t.id} t={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </div>
  );
}

function Toast({ t, onDismiss }: { t: ToastItem; onDismiss?: () => void }) {
  const s = TOAST_TINTS[t.type];
  return (
    <div
      className={cn(
        'animate-toast-in text-body shadow-pop flex items-center gap-2.5 rounded-full px-4.5 py-2.75 font-medium text-white',
        onDismiss && 'pointer-events-auto pr-2.5',
        s.bg,
      )}
    >
      <Icon name={s.icon} size={17} /> {t.msg}
      {t.reference && (
        <span className="font-normal text-white/85">
          · Support reference{' '}
          <span className="font-mono font-semibold select-all">{t.reference}</span>
        </span>
      )}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="ml-1 flex size-7 flex-none cursor-pointer items-center justify-center rounded-full hover:bg-white/15"
        >
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  );
}
