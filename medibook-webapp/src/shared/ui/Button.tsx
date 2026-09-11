import type { CSSProperties, MouseEventHandler, ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/Icon';
import { Spinner } from '@/shared/ui/Spinner';
import type { IconName } from '@/shared/ui/icon-registry';

type ButtonVariant = 'primary' | 'secondary' | 'info' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md';

interface ButtonProps {
  variant?: ButtonVariant;
  icon?: IconName;
  iconRight?: IconName;
  children?: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  /** Runtime data-driven overrides only — static styling goes in className. */
  style?: CSSProperties;
  type?: 'button' | 'submit' | 'reset';
  size?: ButtonSize;
  className?: string;
  /**
   * Action in flight — audit 3.5.6 ("primary buttons are never disabled while
   * working"). Swaps the leading glyph for a `Spinner`, sets `aria-busy`,
   * disables the button and blocks `onClick`, so one slow save cannot be
   * submitted three times. Default `false`.
   */
  busy?: boolean;
  /** Unavailable action: dimmed, `cursor-not-allowed`, no `onClick`. Default `false`. */
  disabled?: boolean;
  /**
   * Native `form` attribute — lets a submit button live outside its `<form>`
   * (how `FormModal` puts Save in the modal footer). Only meaningful with
   * `type="submit"`.
   */
  form?: string;
  /** Accessible name when the button has no text (icon-only usage). */
  ariaLabel?: string;
}

/** Variant fills + the prototype's JS-hover background map as `hover:` classes. */
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-p-500 text-white hover:bg-p-600',
  secondary: 'border border-text-navy bg-white text-text-navy',
  info: 'bg-blue text-white hover:bg-blue-strong',
  ghost: 'bg-transparent text-text-muted',
  danger: 'bg-d-500 text-white hover:bg-d-600',
  success: 'bg-g-600 text-white hover:bg-g-700',
};

export function Button({
  variant = 'primary',
  icon,
  iconRight,
  children,
  onClick,
  style,
  type = 'button',
  size = 'md',
  className,
  busy = false,
  disabled = false,
  form,
  ariaLabel,
}: ButtonProps) {
  const iconSize = size === 'sm' ? 16 : 18;
  const isBlocked = busy || disabled;
  return (
    <button
      type={type}
      form={form}
      aria-label={ariaLabel}
      aria-busy={busy || undefined}
      disabled={isBlocked}
      onClick={isBlocked ? undefined : onClick}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg whitespace-nowrap transition-colors duration-150',
        size === 'sm'
          ? 'text-body px-3.5 py-2 leading-none font-medium'
          : 'text-button px-5 py-2.75',
        VARIANT_CLASSES[variant],
        isBlocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        className,
      )}
      style={style}
    >
      {busy ? <Spinner size={iconSize} decorative /> : icon && <Icon name={icon} size={iconSize} />}
      {children}
      {iconRight && !busy && <Icon name={iconRight} size={iconSize} />}
    </button>
  );
}
