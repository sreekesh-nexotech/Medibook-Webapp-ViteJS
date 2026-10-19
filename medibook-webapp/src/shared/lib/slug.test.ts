import { describe, expect, it } from 'vitest';

import { codeFromName } from './slug';

describe('codeFromName', () => {
  it('lower-cases the name, joins words with dashes and adds a short suffix', () => {
    expect(codeFromName('Dr. Asha Verma', 60)).toMatch(/^dr-asha-verma-[a-z0-9]{4}$/);
  });

  it('drops accents and symbols', () => {
    expect(codeFromName('  Lipid  profile (fasting) ', 40)).toMatch(
      /^lipid-profile-fasting-[a-z0-9]{4}$/,
    );
  });

  it('never exceeds the length limit and never ends the base on a dash', () => {
    const code = codeFromName('Very long service name that keeps going and going', 20);
    expect(code.length).toBeLessThanOrEqual(20);
    expect(code).not.toMatch(/--/);
  });

  it('falls back to "item" when the name has no letters or digits', () => {
    expect(codeFromName('—', 40)).toMatch(/^item-[a-z0-9]{4}$/);
  });
});
