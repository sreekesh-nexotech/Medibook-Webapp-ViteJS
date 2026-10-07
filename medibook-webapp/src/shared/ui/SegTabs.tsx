import { cn } from '@/shared/lib/cn';
import { useTabList } from '@/shared/ui/useTabList';

interface SegTabsProps {
  tabs: readonly string[];
  value: string;
  onChange: (tab: string) => void;
  /** Accessible name of the tab list. */
  ariaLabel?: string;
}

/** Pill segmented control (revenue tabs / period toggles) — keyboard-operable tab list (UAT-76). */
export function SegTabs({ tabs, value, onChange, ariaLabel }: SegTabsProps) {
  const { tabProps } = useTabList(tabs, value, onChange);
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="bg-grey-300 inline-flex items-center gap-1.5 rounded-lg p-1"
    >
      {tabs.map((t, i) => (
        <button
          key={t}
          {...tabProps(t, i)}
          className={cn(
            'text-body cursor-pointer rounded-md px-4 py-2 font-semibold transition-all duration-150',
            value === t ? 'text-text-navy shadow-card bg-white' : 'text-text-muted bg-transparent',
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
