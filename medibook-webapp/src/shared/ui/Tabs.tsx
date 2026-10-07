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
}

/** Underline tab group — a real tab list: Tab reaches it, arrows switch tabs (UAT-76). */
export function Tabs({ tabs, value, onChange, gap = 28, ariaLabel }: TabsProps) {
  const { tabProps } = useTabList(tabs, value, onChange);
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex pr-2" style={{ gap }}>
      {tabs.map((t, i) => (
        <button
          key={t}
          {...tabProps(t, i)}
          className={cn(
            'text-body cursor-pointer border-b-2 pb-1',
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
