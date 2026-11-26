import { describe, expect, it } from 'vitest';

import type { Failure } from '@/core/error/failure';
import {
  coordinatesLabel,
  googleMapsUrl,
  hasLocation,
  mapLocationError,
} from '@/shared/lib/mapLocation';

function failure(partial: Partial<Failure>): Failure {
  return {
    kind: 'server',
    message: 'Something went wrong.',
    code: null,
    status: 500,
    fieldErrors: {},
    requestId: null,
    meta: {},
    ...partial,
  };
}

describe('map location helpers (point 3)', () => {
  it('links to Google Maps on exactly the saved coordinates', () => {
    expect(googleMapsUrl(' 9.926492', '76.313371 ')).toBe(
      'https://www.google.com/maps/search/?api=1&query=9.926492%2C76.313371',
    );
    expect(coordinatesLabel('9.926492', '76.313371')).toBe('9.926492, 76.313371');
  });

  it('needs both halves for a location', () => {
    expect(hasLocation('9.93', '76.26')).toBe(true);
    expect(hasLocation('9.93', ' ')).toBe(false);
    expect(hasLocation('', '')).toBe(false);
  });

  it("shows the server's own sentence for what it could not read", () => {
    const said = 'This link names a place but not its exact spot.';
    expect(
      mapLocationError(
        failure({
          kind: 'validation',
          status: 400,
          code: 'VALIDATION_ERROR',
          fieldErrors: { text: [said] },
        }),
      ),
    ).toBe(said);
  });

  it('explains an unreachable Google Maps and a burst of lookups', () => {
    expect(mapLocationError(failure({ code: 'PROVIDER_UNAVAILABLE', status: 503 }))).toMatch(
      /could not be reached/,
    );
    expect(mapLocationError(failure({ kind: 'network', status: null }))).toMatch(
      /could not be reached/,
    );
    expect(mapLocationError(failure({ status: 429, code: 'RATE_LIMITED' }))).toMatch(
      /Too many lookups/,
    );
    expect(mapLocationError(failure({ message: 'Server said no.' }))).toBe('Server said no.');
  });
});
