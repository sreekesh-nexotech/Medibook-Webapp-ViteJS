import { useEffect, useState } from 'react';

/**
 * Subscribes to a CSS media query. Used by the shells to pick a sidebar
 * presentation (full column / icon rail / off-canvas drawer) — audit 3.4.1,
 * where the sidebar's fixed 254px column is the reason nothing below desktop
 * width works.
 *
 * Layout that can be expressed in Tailwind variants (`sm:`/`md:`/`lg:`) should
 * stay in Tailwind; this hook is only for cases where the *markup* differs,
 * not just the styling.
 */

/** Reading a media query is side-effect free, so it is safe during render. */
function readQuery(query: string): boolean {
  return typeof window === 'undefined' ? false : window.matchMedia(query).matches;
}

interface QueryState {
  readonly query: string;
  readonly matches: boolean;
}

export function useMediaQuery(query: string): boolean {
  // A changed `query` is re-read during render (React's adjust-state-while-
  // rendering pattern) rather than in an effect, so the first paint after a
  // breakpoint change is already correct.
  const [state, setState] = useState<QueryState>(() => ({ query, matches: readQuery(query) }));
  if (state.query !== query) setState({ query, matches: readQuery(query) });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent): void => setState({ query, matches: e.matches });
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return state.matches;
}
