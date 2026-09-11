import { useMediaQuery } from '@/shared/hooks/useMediaQuery';

import { BREAKPOINT_LG_QUERY, BREAKPOINT_MD_QUERY } from '@/core/config/breakpoints';

/**
 * How a shell should present its sidebar at the current viewport — audit
 * 3.4.1/4.6: the web app "contains no responsive rules at all", and the fixed
 * 254px sidebar column is why nothing below desktop width works.
 *
 *   `full`    >= lg (1024px)   the 254px column, exactly as designed
 *   `rail`    md - lg          the existing 76px icon rail (the unused
 *                              `collapsed` option the audit spotted)
 *   `drawer`  < md (768px)     no static column; an off-canvas panel opened
 *                              from the topbar hamburger
 *
 * Desktop resolves to `full`, so nothing about the designed layout changes.
 */
export type SidebarMode = 'full' | 'rail' | 'drawer';

export function useSidebarMode(): SidebarMode {
  const isDesktop = useMediaQuery(BREAKPOINT_LG_QUERY);
  const isTablet = useMediaQuery(BREAKPOINT_MD_QUERY);
  if (isDesktop) return 'full';
  return isTablet ? 'rail' : 'drawer';
}
