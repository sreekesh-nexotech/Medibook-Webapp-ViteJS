import { describe, expect, it } from 'vitest';

import {
  displayAddress,
  displaySetupLink,
} from '@/features/settings/presentation/components/displayLinks';

const ORIGIN = 'https://hospital-dev.medibook.co.in';

describe('display links', () => {
  it('points the TV at /display on this web app', () => {
    expect(displayAddress(ORIGIN)).toBe(`${ORIGIN}/display`);
  });

  it('carries the key on the setup link, encoded', () => {
    expect(displaySetupLink(ORIGIN, 'mbd_ab+c/1')).toBe(`${ORIGIN}/display?key=mbd_ab%2Bc%2F1`);
  });
});
