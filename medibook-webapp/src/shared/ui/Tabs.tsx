import { cn } from '@/shared/lib/cn';
import { useTabList } from '@/shared/ui/useTabList';

interface TabsProps {
  tabs: readonly string[];
  value: string;
  onChange: (tab: string) => void;
  /** Gap between tab labels in px (design default 28 — dynamic, hence style). */
  gap?: number;
  /** Accessible name of the tab list. */
  ariaLabel?: string;
  /** What the tabs switch between, for screen readers (e.g. "Appointment status"). */
  label?: string;
}

/** Underline tab group — a real tab list: Tab reaches it, arrows switch tabs (A11Y-01, UAT-76). */
export function Tabs({ tabs, value, onChange, gap = 28, ariaLabel, label }: TabsProps) {
  const { tabProps } = useTabList(tabs, value, onChange);
  return (
    <div
      role="tablist"
      aria-label={ariaLabel ?? label}
      // Wraps onto a second line on narrow screens instead of pushing the
      // page sideways (PERF-05).
      className="flex flex-wrap gap-y-2 pr-2"
      style={{ columnGap: gap }}
    >
      {tabs.map((t, i) => (
        <button
          key={t}
          {...tabProps(t, i)}
          className={cn(
            'text-body cursor-pointer border-b-2 pb-1 whitespace-nowrap',
            value === t
              ? 'border-text-navy text-text-navy font-semibold'
              : 'text-text-muted border-transparent',
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
