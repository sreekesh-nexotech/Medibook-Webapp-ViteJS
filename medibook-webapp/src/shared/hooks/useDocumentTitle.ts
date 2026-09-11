import { useEffect } from 'react';

/**
 * Sets `document.title` — audit 3.9.2: "The browser tab is wrong for a third
 * of the product: the whole operations console runs under the hospital app's
 * page title." Each shell calls this with its own view label, so the tab,
 * bookmarks, history and window switcher all name the right screen.
 *
 * The title is restored to whatever it was when the component unmounts, so a
 * shell teardown cannot leave a stale screen name in the tab.
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
