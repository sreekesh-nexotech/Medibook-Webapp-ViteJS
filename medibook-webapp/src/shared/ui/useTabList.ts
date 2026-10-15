import { useRef } from 'react';
import type { KeyboardEvent } from 'react';

import { nextTabIndex } from '@/shared/lib/rovingTabs';

/**
 * Roving-focus wiring for `Tabs` and `SegTabs`: the selected tab is the one
 * Tab stop, the arrow keys / Home / End select and focus a neighbour.
 */
export function useTabList(
  tabs: readonly string[],
  value: string,
  onChange: (tab: string) => void,
) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = Math.max(0, tabs.indexOf(value));

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const next = nextTabIndex(event.key, index, tabs.length);
    if (next === null) return;
    event.preventDefault();
    onChange(tabs[next]);
    refs.current[next]?.focus();
  };

  const tabProps = (tab: string, index: number) => ({
    ref: (el: HTMLButtonElement | null) => {
      refs.current[index] = el;
    },
    type: 'button' as const,
    role: 'tab',
    'aria-selected': value === tab,
    tabIndex: index === selectedIndex ? 0 : -1,
    onClick: () => onChange(tab),
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => onKeyDown(event, index),
  });

  return { tabProps };
}
