import { useRovingFocus } from '@/shared/hooks/useRovingFocus';
import { cn } from '@/shared/lib/cn';

interface TabsProps {
  tabs: readonly string[];
  value: string;
  onChange: (tab: string) => void;
  /** Gap between tab labels in px (design default 28 — dynamic, hence style). */
  gap?: number;
  /** What the tabs switch between, for screen readers (e.g. "Appointment status"). */
  label?: string;
}

/** Underline tab group: real tabs, reachable and switchable from the keyboard (A11Y-01). */
export function Tabs({ tabs, value, onChange, gap = 28, label }: TabsProps) {
  const { optionProps } = useRovingFocus(tabs, value, onChange);
  return (
    <div
      role="tablist"
      aria-label={label}
      // Wraps onto a second line on narrow screens instead of pushing the
      // page sideways (PERF-05).
      className="flex flex-wrap gap-y-2 pr-2"
      style={{ columnGap: gap }}
    >
      {tabs.map((t, i) => (
        <button
          key={t}
          type="button"
          role="tab"
          aria-selected={value === t}
          {...optionProps(t, i)}
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
