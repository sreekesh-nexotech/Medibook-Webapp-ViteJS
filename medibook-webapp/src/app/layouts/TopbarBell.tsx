import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/Icon';
import type { IconName } from '@/shared/ui/icon-registry';

import { usePopoverDismiss } from './usePopoverDismiss';

/** One bell row, built by the shell from live data. */
export interface TopbarBellItem {
  readonly key: string;
  readonly icon: IconName;
  /** Icon-box tint as token classes. */
  readonly boxClass: string;
  readonly title: string;
  readonly sub: string;
  readonly unread: boolean;
}

interface TopbarBellProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  items: readonly TopbarBellItem[];
  /** A source the bell reads failed: show it, never "all caught up" (UAT-68). */
  isError: boolean;
  onRetry: () => void;
  onSelect: (item: TopbarBellItem) => void;
  /** Offered while something is unread; omitted where read state is not kept. */
  onMarkAllRead?: () => void;
  /** Unread-dot token class (the hospital and ops designs differ). */
  dotClass: string;
  /** Panel width token class. */
  panelWidthClass: string;
}

/**
 * The topbar notification bell for both shells: a named toggle with the
 * unread count, a panel of keyboard-operable rows, an error row when a
 * source failed, and Escape to close (01·F18, F19).
 */
export function TopbarBell({
  open,
  onToggle,
  onClose,
  items,
  isError,
  onRetry,
  onSelect,
  onMarkAllRead,
  dotClass,
  panelWidthClass,
}: TopbarBellProps) {
  const triggerRef = usePopoverDismiss(open, onClose);
  const unread = items.filter((n) => n.unread).length;
  const label = unread > 0 ? `Notifications, ${unread} unread` : 'Notifications';
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={onToggle}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="true"
        className={cn('relative flex cursor-pointer', open ? 'text-text-navy' : 'text-text-muted')}
      >
        <Icon name="bell" size={21} />
        {unread > 0 && (
          <span className="bg-d-500 absolute -top-1.25 -right-1.5 flex h-3.75 min-w-3.75 items-center justify-center rounded-full border-[1.5px] border-white px-1 text-[10px] font-semibold text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div onClick={onClose} className="fixed inset-0 z-30" />
          <div
            role="region"
            aria-label="Notifications"
            className={cn(
              'border-border shadow-pop absolute top-18 right-2 z-40 max-w-full overflow-hidden rounded-lg border bg-white lg:right-18.5',
              panelWidthClass,
            )}
          >
            <div className="border-border-soft flex items-center justify-between border-b px-4 py-3.5">
              <span className="text-text-strong text-[15px] font-semibold">Notifications</span>
              {onMarkAllRead && unread > 0 && (
                <button
                  type="button"
                  className="text-caption text-blue cursor-pointer"
                  onClick={onMarkAllRead}
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-90 overflow-y-auto">
              {isError && (
                <div
                  role="alert"
                  className="text-caption text-danger bg-d-100 flex items-center gap-2 px-4 py-3"
                >
                  <Icon name="triangle-alert" size={15} />
                  <span className="flex-1">Some notifications could not be loaded.</span>
                  <button
                    type="button"
                    onClick={onRetry}
                    className="text-blue cursor-pointer font-medium"
                  >
                    Retry
                  </button>
                </div>
              )}
              {items.length === 0 && !isError && (
                <div className="text-text-faint text-body py-7 text-center">
                  {"You're all caught up."}
                </div>
              )}
              {items.map((n, i) => (
                <button
                  key={n.key}
                  type="button"
                  onClick={() => onSelect(n)}
                  className={cn(
                    'hover:bg-grey-200 flex w-full cursor-pointer items-start gap-3 px-4 py-3.25 text-left transition-colors duration-150',
                    i < items.length - 1 && 'border-border-soft border-b',
                    n.unread ? 'bg-bg-app' : 'bg-white',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-8.5 flex-none items-center justify-center rounded-md',
                      n.boxClass,
                    )}
                  >
                    <Icon name={n.icon} size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-body text-text-strong block font-medium">{n.title}</span>
                    <span className="text-caption text-text-muted block">{n.sub}</span>
                  </span>
                  {n.unread && (
                    <span className={cn('mt-1.5 size-1.75 flex-none rounded-full', dotClass)}>
                      <span className="sr-only">Unread</span>
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
