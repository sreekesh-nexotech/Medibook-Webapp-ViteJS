import { describe, expect, it } from 'vitest';

import {
  resolvedMapLocationResponseSchema,
  toResolvedMapLocation,
} from '@/core/api/mapLocation.response';

describe('resolved map location (point 3)', () => {
  it('reads the server answer', () => {
    const dto = resolvedMapLocationResponseSchema.parse({
      lat: '9.926492',
      lng: '76.313371',
      source: 'short_link',
      in_india: true,
    });
    expect(toResolvedMapLocation(dto)).toEqual({
      lat: '9.926492',
      lng: '76.313371',
      source: 'short_link',
      inIndia: true,
    });
  });

  it('refuses an answer it does not understand', () => {
    expect(() =>
      resolvedMapLocationResponseSchema.parse({ lat: 9.9, lng: 76.2, source: 'gps' }),
    ).toThrow();
  });
});
