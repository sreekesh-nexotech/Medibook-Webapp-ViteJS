import { describe, expect, it } from 'vitest';

import { createActionKeys } from '@/shared/lib/actionKeys';

function counter() {
  let n = 0;
  return () => {
    n += 1;
    return `key-${n}`;
  };
}

describe('idempotency keys per user action (UAT-16)', () => {
  it('reuses the key for every retry of the same action', () => {
    const keys = createActionKeys(counter());
    const first = keys.keyFor('book');
    expect(keys.keyFor('book')).toBe(first);
    expect(keys.keyFor('book')).toBe(first);
  });

  it('gives different actions different keys', () => {
    const keys = createActionKeys(counter());
    expect(keys.keyFor('check-in:a')).not.toBe(keys.keyFor('check-in:b'));
  });

  it('mints a new key only after the action succeeded', () => {
    const keys = createActionKeys(counter());
    const first = keys.keyFor('refund:a');
    keys.settle('refund:a');
    expect(keys.keyFor('refund:a')).not.toBe(first);
  });
});
