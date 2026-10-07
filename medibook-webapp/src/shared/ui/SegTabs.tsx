import { useRovingFocus } from '@/shared/hooks/useRovingFocus';
import { cn } from '@/shared/lib/cn';

interface SegTabsProps {
  tabs: readonly string[];
  value: string;
  onChange: (tab: string) => void;
  /** What the toggle chooses, for screen readers (e.g. "Revenue period"). */
  label?: string;
}

/**
 * Pill segmented control (used for revenue tabs / period toggles): one choice
 * of several, so a radio group that arrow keys move through (A11Y-01).
 */
export function SegTabs({ tabs, value, onChange, label }: SegTabsProps) {
  const { optionProps } = useRovingFocus(tabs, value, onChange);
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="bg-grey-300 inline-flex items-center gap-1.5 rounded-lg p-1"
    >
      {tabs.map((t, i) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={value === t}
          {...optionProps(t, i)}
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
