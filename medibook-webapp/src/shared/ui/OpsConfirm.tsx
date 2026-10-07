import type { ComponentProps, ReactNode } from 'react';

import { useDialog } from '@/shared/hooks/useDialog';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import type { IconName } from '@/shared/ui/icon-registry';

/**
 * Ops accent tints as [background class, foreground class] pairs — ported 1:1
 * from Ops.jsx `OPS_TINTS` (CSS variable pairs → Tailwind token classes).
 * Shared by OpsConfirm, OpsEntity and the ops screens' tinted icon boxes.
 */
export const OPS_TINTS = {
  primary: ['bg-blue-soft-bg', 'text-text-navy'],
  info: ['bg-blue-soft-bg', 'text-blue'],
  success: ['bg-g-100', 'text-g-800'],
  warning: ['bg-y-100', 'text-y-800'],
  danger: ['bg-d-100', 'text-d-600'],
  orange: ['bg-badge-noshow-bg', 'text-orange-strong'],
  neutral: ['bg-grey-300', 'text-text-muted'],
} as const satisfies Record<string, readonly [string, string]>;

export type OpsTint = keyof typeof OPS_TINTS;

export interface OpsConfirmSummaryItem {
  readonly k: string;
  readonly v: ReactNode;
  /** Render the value with tabular numerals (the prototype's `num` class). */
  readonly num?: boolean;
}

interface OpsConfirmProps {
  open: boolean;
  onClose: () => void;
  icon: IconName;
  tone?: OpsTint;
  title?: ReactNode;
  body?: ReactNode;
  /** Key/value rows shown in the grey summary box under the title. */
  summary?: readonly OpsConfirmSummaryItem[];
  confirmLabel?: ReactNode;
  confirmVariant?: ComponentProps<typeof Button>['variant'];
  onConfirm?: () => void;
  busy?: boolean;
  disabled?: boolean;
  children?: ReactNode;
}

/**
 * Centered ops confirm dialog (approve / reject / suspend / release / delete /
 * block). The prototype positioned this absolutely inside its windowed stage —
 * ported as a fixed full-viewport overlay (same visual at 100% zoom).
 *
 * It is a real dialog (A11Y-02): announced as an alert dialog with its title
 * and message, focus moves into it and stays there, Escape cancels, and focus
 * returns to the button that opened it. While the action runs, it cannot be
 * dismissed.
 */
export function OpsConfirm({
  open,
  onClose,
  icon,
  tone = 'warning',
  title,
  body,
  summary,
  confirmLabel,
  confirmVariant = 'primary',
  onConfirm,
  busy,
  disabled,
  children,
}: OpsConfirmProps) {
  const { panelRef, titleId, descriptionId } = useDialog({
    open,
    onClose,
    closeOnEscape: !busy,
  });
  if (!open) return null;
  const t = OPS_TINTS[tone];
  return (
    <div
      onClick={busy ? undefined : onClose}
      className="animate-fade-in bg-text-strong/45 fixed inset-0 z-50 flex items-center justify-center p-6"
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={body ? descriptionId : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="animate-pop-in shadow-pop flex w-112 max-w-full flex-col items-center gap-4 rounded-xl bg-white p-6 text-center"
      >
        <div className={cn('flex size-13 items-center justify-center rounded-full', t[0], t[1])}>
          <Icon name={icon} size={24} />
        </div>
        <SectionTitle id={titleId} size={20}>
          {title}
        </SectionTitle>
        {summary && (
          <div className="bg-bg-subtle border-border flex w-full flex-col gap-2 rounded-md border px-4 py-3 text-left">
            {summary.map((s) => (
              <div key={s.k} className="flex justify-between gap-3">
                <span className="text-caption text-text-muted">{s.k}</span>
                <span
                  className={cn('text-body text-text-strong font-medium', s.num && 'tabular-nums')}
                >
                  {s.v}
                </span>
              </div>
            ))}
          </div>
        )}
        {children}
        <p id={descriptionId} className="text-body text-text-muted m-0">
          {body}
        </p>
        <div className="flex justify-center gap-3">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} busy={busy} disabled={disabled}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
