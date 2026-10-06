import { describe, expect, it } from 'vitest';

/**
 * The yellow scale is named `y` (`--color-y-300`), and `x`/`y` are also
 * Tailwind's axes: a colour step after an axis utility compiles to a width or a
 * distance as well. The Held slot legend's yellow border class, written that way,
 * drew 300px top and bottom borders. Colour classes must use a token with
 * another name. (The class is not spelled out here: Tailwind scans this file
 * too and would emit its CSS.)
 */
const sources = import.meta.glob<string>(['/src/**/*.{ts,tsx}', '!/src/**/*.test.ts'], {
  eager: true,
  query: '?raw',
  import: 'default',
});

const AXIS_WITH_SCALE_STEP = /\b(?:border|divide|space|gap|inset|translate)-[xy]-[1-9]00\b/g;

describe('Tailwind classes', () => {
  it('never put a colour-scale step after an x or y axis utility', () => {
    const hits = Object.entries(sources).flatMap(([file, text]) =>
      [...text.matchAll(AXIS_WITH_SCALE_STEP)].map((match) => `${file}: ${match[0]}`),
    );
    expect(hits).toEqual([]);
  });
});
