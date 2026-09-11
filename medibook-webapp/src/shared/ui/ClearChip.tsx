import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/Icon';

interface ClearChipProps {
  /** Clear the screen's filters. Without it the chip renders inert and dimmed. */
  onClick?: () => void;
  /** Chip text. Default "Clear all". */
  label?: string;
  tint?: boolean;
}

/**
 * Toolbar "Clear all" filter chip.
 *
 * A real `<button>`, so it is reachable from the keyboard and announced — and
 * when no `onClick` is supplied it renders visibly inert rather than looking
 * clickable and doing nothing (audit 3.1: controls that appear live but are
 * not). `EmptyState`'s ghost action is the in-table equivalent.
 */
export function ClearChip({ onClick, label = 'Clear all', tint = true }: ClearChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'text-body inline-flex items-center gap-1.5 rounded-md px-3.5 py-2.25',
        tint ? 'bg-blue-soft-bg text-blue' : 'bg-grey-300 text-text-muted',
        onClick ? 'cursor-pointer' : 'cursor-not-allowed opacity-50',
      )}
    >
      {label} <Icon name="x" size={14} />
    </button>
  );
}
