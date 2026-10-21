import { DISPLAY_KEY_PARAM, DISPLAY_PATH } from '@/app/router/paths';

/** Where a waiting-room TV opens the display: `https://…/display` on this web app's own address. */
export function displayAddress(origin: string): string {
  return `${origin}${DISPLAY_PATH}`;
}

/**
 * The display address with the screen's key already filled in (`?key=`): opened
 * once on the TV it signs in at once, and the display drops the key from the
 * address bar (see `DisplayScreen`). It carries the key, so it is shown only
 * where the key itself is.
 */
export function displaySetupLink(origin: string, key: string): string {
  return `${displayAddress(origin)}?${new URLSearchParams({ [DISPLAY_KEY_PARAM]: key })}`;
}
