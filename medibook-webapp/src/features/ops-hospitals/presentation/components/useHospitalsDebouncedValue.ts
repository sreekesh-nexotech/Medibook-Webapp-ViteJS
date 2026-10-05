import { useEffect, useState } from 'react';

/**
 * `value`, once it has stopped changing for `delayMs` — so the registry
 * search sends one request per pause in typing, not one per keystroke.
 */
export function useHospitalsDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}
