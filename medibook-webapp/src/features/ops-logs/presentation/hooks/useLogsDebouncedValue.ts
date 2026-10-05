import { useEffect, useState } from 'react';

/**
 * `value`, settled for `delayMs` — so the audit-trail search sends one
 * `?q=` request when typing pauses instead of one per keystroke.
 */
export function useLogsDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}
