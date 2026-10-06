import type { SlotCellState } from '@/features/slots/presentation/components/slotsGridView';
import type { IconName } from '@/shared/ui/icon-registry';

/** How one slot state is drawn: box classes, glyph and legend label. */
export interface SlotStateStyle {
  readonly box: string;
  readonly icon: IconName;
  readonly label: string;
}

/**
 * Slot states use the product's existing status palette, so a slot reads the
 * same way as an appointment badge: green = free, amber = held for payment,
 * blue = taken, red = blocked, grey = gone. Shared by the grid cells and the
 * legend, so the two can never disagree about what a colour means.
 */
export const SLOT_STATE_STYLE: Readonly<Record<SlotCellState, SlotStateStyle>> = {
  available: {
    box: 'bg-g-100 border-g-200 text-g-800',
    icon: 'circle-check',
    label: 'Available',
  },
  held: {
    box: 'bg-badge-queue-bg border-badge-queue-border text-badge-queue-fg',
    icon: 'credit-card',
    label: 'Held',
  },
  booked: {
    box: 'bg-badge-scheduled-bg border-blue text-badge-scheduled-fg',
    icon: 'user-check',
    label: 'Booked',
  },
  blocked: {
    box: 'bg-badge-cancelled-bg border-d-200 text-badge-cancelled-fg',
    icon: 'ban',
    label: 'Blocked',
  },
  past: {
    box: 'bg-grey-300 border-border-soft text-text-muted',
    icon: 'clock',
    label: 'Past',
  },
};

/** Only these can be changed from the grid: held, booked and past slots are not up for grabs. */
export function isTogglableState(state: SlotCellState): boolean {
  return state === 'available' || state === 'blocked';
}
