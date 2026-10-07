import { describe, expect, it } from 'vitest';

// Raw text of the stylesheet (`vitest.config.ts` lets this one file through).
import css from '/src/index.css?raw';

/**
 * WCAG contrast of the colour pairs the app puts text and controls on
 * (A11Y-05, A11Y-06): body text and badges at least 4.5:1, form-control
 * edges at least 3:1. Values are read from the `@theme` tokens in
 * `src/index.css`, so changing a token re-checks every pair that uses it.
 */

const TEXT = 4.5;
const NON_TEXT = 3;

type Rgb = readonly [number, number, number];

const tokens = new Map(
  [...css.matchAll(/--color-([a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()] as const),
);

const WHITE: Rgb = [255, 255, 255];

/** A token as an opaque colour; translucent ones are laid over `under`. */
function colour(name: string, under: Rgb = WHITE): Rgb {
  const value = tokens.get(name);
  if (value === undefined) throw new Error(`No --color-${name} in index.css`);
  const ref = /^var\(--color-([a-z0-9-]+)\)$/.exec(value);
  if (ref) return colour(ref[1], under);
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const n = Number.parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgba = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(value);
  if (rgba) {
    const a = Number(rgba[4]);
    const mix = (c: string, i: number) => Math.round(Number(c) * a + under[i] * (1 - a));
    return [mix(rgba[1], 0), mix(rgba[2], 1), mix(rgba[3], 2)];
  }
  throw new Error(`Cannot read --color-${name}: ${value}`);
}

function luminance([r, g, b]: Rgb): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function ratio(fg: Rgb, bg: Rgb): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

/** [foreground token, background token, minimum ratio]. */
const PAIRS: readonly (readonly [string, string, number])[] = [
  // Body and secondary text on every surface it sits on.
  ['text-strong', 'white', TEXT],
  ['text-body', 'white', TEXT],
  ['text-navy', 'white', TEXT],
  ['text-muted', 'white', TEXT],
  ['text-muted', 'grey-200', TEXT],
  ['text-muted', 'bg-app', TEXT],
  ['text-muted', 'grey-300', TEXT],
  ['text-muted', 'bg-subtle', TEXT],
  ['text-muted', 'blue-soft-bg', TEXT],
  // Coloured text.
  ['link', 'white', TEXT],
  ['blue', 'white', TEXT],
  ['blue', 'blue-soft-bg', TEXT],
  ['danger', 'white', TEXT],
  ['danger', 'd-100', TEXT],
  ['d-600', 'white', TEXT],
  ['d-600', 'd-100', TEXT],
  ['g-800', 'white', TEXT],
  ['g-800', 'g-100', TEXT],
  ['y-800', 'white', TEXT],
  ['y-800', 'y-100', TEXT],
  ['orange-strong', 'white', TEXT],
  // White text on filled buttons, toasts and their hover states.
  ['white', 'success', TEXT],
  ['white', 'g-800', TEXT],
  ['white', 'danger', TEXT],
  ['white', 'd-600', TEXT],
  ['white', 'd-700', TEXT],
  ['white', 'blue', TEXT],
  ['white', 'blue-strong', TEXT],
  ['white', 'p-500', TEXT],
  ['white', 'p-600', TEXT],
  // Status badges.
  ['badge-scheduled-fg', 'badge-scheduled-bg', TEXT],
  ['badge-completed-fg', 'badge-completed-bg', TEXT],
  ['badge-queue-fg', 'badge-queue-bg', TEXT],
  ['badge-cancelled-fg', 'badge-cancelled-bg', TEXT],
  ['badge-noshow-fg', 'badge-noshow-bg', TEXT],
  // The edge of a form control against what is around it.
  ['border-control', 'white', NON_TEXT],
  ['border-control', 'bg-subtle', NON_TEXT],
  ['border-control', 'grey-200', NON_TEXT],
];

describe('colour contrast of the theme tokens', () => {
  for (const [fg, bg, min] of PAIRS) {
    it(`${fg} on ${bg} is at least ${min}:1`, () => {
      const background = colour(bg);
      expect(ratio(colour(fg, background), background)).toBeGreaterThanOrEqual(min);
    });
  }
});

/**
 * Classes whose colours fail on white and were replaced (A11Y-05/06). Built
 * from parts: Tailwind scans this file and would otherwise generate them.
 */
const RETIRED = [
  ['text', 'g', '600'],
  ['text', 'g', '700'],
  ['text', 'y', '600'],
  ['text', 'd', '500'],
  ['bg', 'd', '500'],
  ['bg', 'g', '600'],
].map((parts) => parts.join('-'));

const sources = import.meta.glob<string>(['/src/**/*.{ts,tsx}', '!/src/**/*.test.ts'], {
  eager: true,
  query: '?raw',
  import: 'default',
});

describe('retired low-contrast classes', () => {
  it('are not used again', () => {
    const pattern = new RegExp(`(?<![\\w-])(${RETIRED.join('|')})(?![\\w-])`, 'g');
    const hits = Object.entries(sources).flatMap(([file, text]) =>
      [...text.matchAll(pattern)].map((m) => `${file}: ${m[0]}`),
    );
    expect(hits).toEqual([]);
  });
});
