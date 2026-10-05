import type { SlotCellView } from '@/features/slots/presentation/components/slotsGridView';
import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/Icon';

import { SLOT_STATE_STYLE, isTogglableState } from './slotStateStyle';

interface SlotCellProps {
  slot: SlotCellView;
  doctorName: string;
  /** Open / block this slot. Omit it for a read-only grid. */
  onToggle?: (slot: SlotCellView) => void;
  /** This slot's change is in flight. */
  busy?: boolean;
}

/** One slot in the grid: a real button when it can be changed, static when not. */
export function SlotCell({ slot, doctorName, onToggle, busy = false }: SlotCellProps) {
  const style = SLOT_STATE_STYLE[slot.state];
  const canChange = Boolean(onToggle) && isTogglableState(slot.state) && !busy;
  const action = slot.state === 'blocked' ? 'Open this slot' : 'Block this slot';
  const detail = slot.detail ? `${style.label} — ${slot.detail}` : style.label;
  const name = `${doctorName}, ${slot.label} — ${detail}.${canChange ? ` ${action}.` : ''}`;

  return (
    <button
      type="button"
      aria-label={name}
      aria-busy={busy || undefined}
      title={canChange ? `${slot.label} · ${detail} — ${action}` : `${slot.label} · ${detail}`}
      disabled={!canChange}
      onClick={canChange && onToggle ? () => onToggle(slot) : undefined}
      className={cn(
        'text-caption flex h-11 w-full flex-col items-center justify-center gap-0.5 rounded-md border font-medium',
        style.box,
        canChange ? 'cursor-pointer hover:opacity-80' : 'cursor-default',
        busy && 'opacity-60',
      )}
    >
      <Icon name={style.icon} size={14} />
      <span className="tabular-nums">{slot.label}</span>
    </button>
  );
}
