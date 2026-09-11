import { isMutableState, type Slot } from '@/features/slots/domain/slot';
import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/Icon';

import { SLOT_STATE_STYLE } from './slotStateStyle';

interface SlotCellProps {
  slot: Slot;
  doctorName: string;
  /** Open / block this slot. Omit it for a read-only grid. */
  onToggle?: (slot: Slot) => void;
}

/** One slot in the grid: a real button when it can be changed, static when not. */
export function SlotCell({ slot, doctorName, onToggle }: SlotCellProps) {
  const style = SLOT_STATE_STYLE[slot.state];
  const canChange = Boolean(onToggle) && isMutableState(slot.state);
  const action = slot.state === 'blocked' ? 'Open this slot' : 'Block this slot';
  const detail =
    slot.state === 'booked' ? `Booked — ${slot.bookedFor ?? 'appointment'}` : style.label;
  const name = `${doctorName}, ${slot.label} — ${detail}.${canChange ? ` ${action}.` : ''}`;

  return (
    <button
      type="button"
      aria-label={name}
      title={canChange ? `${slot.label} · ${detail} — ${action}` : `${slot.label} · ${detail}`}
      disabled={!canChange}
      onClick={canChange && onToggle ? () => onToggle(slot) : undefined}
      className={cn(
        'text-caption flex h-11 w-full flex-col items-center justify-center gap-0.5 rounded-md border font-medium',
        style.box,
        canChange ? 'cursor-pointer hover:opacity-80' : 'cursor-default',
      )}
    >
      <Icon name={style.icon} size={14} />
      <span className="tabular-nums">{slot.label}</span>
    </button>
  );
}
