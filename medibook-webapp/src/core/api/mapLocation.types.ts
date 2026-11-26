/**
 * A hospital's map location read from what someone pasted (client feedback point 3): a Google
 * Maps link — full, or a short `maps.app.goo.gl` share link the server opens — or typed
 * coordinates. Nothing is saved by reading it; the form saves `lat`/`lng` with the profile.
 */
export interface ResolvedMapLocation {
  /** Latitude with 6 decimal places, as the server will store it, e.g. `"9.931200"`. */
  readonly lat: string;
  readonly lng: string;
  readonly source: 'coordinates' | 'link' | 'short_link';
  /** `false` → the form warns before saving (a pasted link for the wrong place). */
  readonly inIndia: boolean;
}
