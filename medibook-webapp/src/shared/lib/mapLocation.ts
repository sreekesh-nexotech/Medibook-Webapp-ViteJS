import type { Failure } from '@/core/error/failure';

/**
 * Helpers for the hospital "Google Maps location" field (client feedback point 3): the client
 * chose pasting a Google Maps link or typing coordinates over a map picker (no Google account,
 * no cost), so the form only ever links out to Google Maps to check the spot.
 */

/** Google's documented "search" URL: opens the map on exactly these coordinates, no key needed. */
const GOOGLE_MAPS_SEARCH = 'https://www.google.com/maps/search/?api=1&query=';

const HTTP_TOO_MANY = 429;
const UNREACHABLE =
  'Google Maps could not be reached just now. Try again in a moment, or type the coordinates.';
const TOO_MANY = 'Too many lookups in a minute. Wait a moment, then try again.';
const GENERIC = 'This location could not be read. Paste the Google Maps link again.';

export function googleMapsUrl(lat: string, lng: string): string {
  return `${GOOGLE_MAPS_SEARCH}${encodeURIComponent(`${lat.trim()},${lng.trim()}`)}`;
}

/** "9.931200, 76.267300" — how the form shows a saved location. */
export function coordinatesLabel(lat: string, lng: string): string {
  return `${lat.trim()}, ${lng.trim()}`;
}

/** Both halves of a location are filled in. */
export function hasLocation(lat: string, lng: string): boolean {
  return lat.trim() !== '' && lng.trim() !== '';
}

/** The sentence to show under the box when a pasted location could not be read. */
export function mapLocationError(failure: Failure): string {
  const fromServer = failure.fieldErrors['text']?.[0];
  if (fromServer) return fromServer;
  if (failure.code === 'PROVIDER_UNAVAILABLE' || failure.kind === 'network') return UNREACHABLE;
  if (failure.status === HTTP_TOO_MANY) return TOO_MANY;
  return failure.message || GENERIC;
}
