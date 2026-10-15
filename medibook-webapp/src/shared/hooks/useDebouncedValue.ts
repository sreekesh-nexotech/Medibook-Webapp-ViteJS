import { useEffect, useState } from 'react';

/**
 * `value`, but only once it has stopped changing for `delayMs` — so a search
 * box sends one request when the user pauses, not one per keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return settled;
}
