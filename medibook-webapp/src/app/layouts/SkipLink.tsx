/** The id of each shell's main content, the skip link's target. */
export const MAIN_CONTENT_ID = 'main-content';

/**
 * "Skip to main content": the first stop for a keyboard user, hidden until it
 * has focus, so they need not tab through the sidebar on every screen
 * (A11Y-07). Focus moves without touching the URL.
 */
export function SkipLink() {
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      onClick={(e) => {
        e.preventDefault();
        document.getElementById(MAIN_CONTENT_ID)?.focus();
      }}
      className="text-body text-text-navy focus:shadow-pop sr-only font-semibold focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-9999 focus:rounded-md focus:bg-white focus:px-4 focus:py-2.5"
    >
      Skip to main content
    </a>
  );
}
