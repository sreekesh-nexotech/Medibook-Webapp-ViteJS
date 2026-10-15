import { describe, expect, it } from 'vitest';

import { maskedContactSchema, toContactLine } from '@/core/api/labels.response';

describe('toContactLine', () => {
  it('joins the masked phone and email B6 sends as an object', () => {
    const dto = maskedContactSchema.parse({ email: 'a***@x.in', phone: '+91******10' });
    expect(toContactLine(dto)).toBe('+91******10 · a***@x.in');
  });

  it('accepts a flat string and nothing at all', () => {
    expect(toContactLine('a***@x.in')).toBe('a***@x.in');
    expect(toContactLine(null)).toBeNull();
    expect(toContactLine({ email: null, phone: null })).toBeNull();
  });
});
