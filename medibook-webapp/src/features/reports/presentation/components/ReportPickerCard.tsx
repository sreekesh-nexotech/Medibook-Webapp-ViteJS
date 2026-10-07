import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/Icon';

import { CAT_ICON_CLASS } from '../reports.data';
import type { ReportCatalogItem } from '../reports.design';

interface ReportPickerCardProps {
  report: ReportCatalogItem;
  selected: boolean;
  onSelect: () => void;
}

/**
 * One report tile in the picker grid. Selected → blue ring + soft-blue fill
 * (design `on ? '1.5px solid var(--blue)' : '1px solid var(--border)'`).
 */
export function ReportPickerCard({ report, selected, onSelect }: ReportPickerCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'shadow-card flex w-full cursor-pointer items-start gap-3 rounded-xl border p-4 text-left transition-colors duration-150',
        selected ? 'border-blue bg-blue-soft-bg' : 'border-border bg-white',
      )}
    >
      <span
        className={cn(
          'flex size-9.5 flex-none items-center justify-center rounded-md',
          CAT_ICON_CLASS[report.cat],
        )}
      >
        <Icon name={report.icon} size={19} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-body text-text-strong block font-medium">{report.title}</span>
        <span className="text-caption text-text-muted mt-0.5 block">{report.brief}</span>
      </span>
      {selected && <Icon name="check" size={16} className="text-blue flex-none" />}
    </button>
  );
}
