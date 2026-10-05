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
    <div
      onClick={onSelect}
      className={cn(
        'shadow-card flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors duration-150',
        selected ? 'border-blue bg-blue-soft-bg' : 'border-border bg-white',
      )}
    >
      <div
        className={cn(
          'flex size-9.5 flex-none items-center justify-center rounded-md',
          CAT_ICON_CLASS[report.cat],
        )}
      >
        <Icon name={report.icon} size={19} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-body text-text-strong font-medium">{report.title}</div>
        <div className="text-caption text-text-muted mt-0.5">{report.brief}</div>
      </div>
      {selected && <Icon name="check" size={16} className="text-blue flex-none" />}
    </div>
  );
}
