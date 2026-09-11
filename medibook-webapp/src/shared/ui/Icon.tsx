import type { CSSProperties } from 'react';

import { cn } from '@/shared/lib/cn';

import { ICONS, type IconName } from './icon-registry';

interface IconProps {
  name: IconName;
  /** Square box + glyph size in px (dynamic, data-driven — hence style). */
  size?: number;
  /** Runtime color override (data-driven, e.g. per-department accents). */
  color?: string;
  className?: string;
  style?: CSSProperties;
  strokeWidth?: number;
  /**
   * Set this only when the glyph is the *sole* content of a control and there
   * is no other accessible name — then it is announced instead of hidden.
   * Prefer naming the control (`IconBtn label`, `Button ariaLabel`) and
   * leaving the glyph decorative.
   */
  label?: string;
}

/**
 * Lucide glyph in an inline-flex box, exactly like the design file's Icon —
 * the wrapper keeps glyphs baseline-free so rows center pixel-identically.
 *
 * Icons are **decorative by default** (audit 3.3.2): the wrapper is
 * `aria-hidden` and the SVG is `focusable="false"`, so a screen reader reads
 * the control's name once instead of announcing a stray graphic, and IE-era
 * SVG tab stops never appear.
 */
export function Icon({ name, size = 20, color, className, style, strokeWidth, label }: IconProps) {
  const Glyph = ICONS[name];
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('inline-flex items-center justify-center', className)}
      style={{ width: size, height: size, color, ...style }}
    >
      <Glyph size={size} strokeWidth={strokeWidth} focusable="false" className="block" />
    </span>
  );
}
