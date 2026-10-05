import { useEffect, useState } from 'react';

/**
 * `value`, once it has stopped changing for `delayMs` — so the invoice search
 * sends one request per pause in typing, not one per keystroke.
 */
export function useBillingDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}
