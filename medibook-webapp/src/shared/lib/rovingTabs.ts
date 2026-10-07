/**
 * Keyboard model of a tab list (WAI-ARIA Authoring Practices, "Tabs"): the
 * arrow keys move to the previous/next tab (wrapping), Home and End to the
 * first and last. Returns the index to select, or `null` when the key is not
 * a tab-list key (UAT-76, 01·F31).
 */
export function nextTabIndex(key: string, current: number, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (current + 1) % count;
    case 'ArrowLeft':
    case 'ArrowUp':
      return (current - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}
