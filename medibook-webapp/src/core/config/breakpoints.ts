/**
 * The viewport breakpoints the shells branch on, as media-query strings.
 *
 * These mirror Tailwind's own `--breakpoint-*` tokens (which survived the
 * `--color-*: initial` palette wipe — only colours were cleared), so a
 * JS-driven layout decision and a `md:` / `lg:` utility always flip at the
 * same pixel:
 *
 *   sm  40rem / 640px
 *   md  48rem / 768px   tablet — sidebar becomes a 76px icon rail
 *   lg  64rem / 1024px  desktop — full 254px sidebar, unchanged
 *
 * Use a Tailwind variant whenever only styling changes; these constants are
 * for the cases where the *markup* differs (see `useSidebarMode`).
 */

export const BREAKPOINT_SM_QUERY = '(min-width: 40rem)';
export const BREAKPOINT_MD_QUERY = '(min-width: 48rem)';
export const BREAKPOINT_LG_QUERY = '(min-width: 64rem)';
