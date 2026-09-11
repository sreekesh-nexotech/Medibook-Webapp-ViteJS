import type { SlotState } from '@/features/slots/domain/slot';
import type { IconName } from '@/shared/ui/icon-registry';

/** How one slot state is drawn: box classes, glyph and legend label. */
export interface SlotStateStyle {
  readonly box: string;
  readonly icon: IconName;
  readonly label: string;
}

/**
 * Slot states use the product's existing status palette, so a slot reads the
 * same way as an appointment badge: green = free, blue = taken, red = blocked,
 * grey = gone. Shared by the grid cells and the legend, so the two can never
 * disagree about what a colour means.
 */
export const SLOT_STATE_STYLE: Readonly<Record<SlotState, SlotStateStyle>> = {
  available: {
    box: 'bg-g-100 border-g-200 text-g-800',
    icon: 'circle-check',
    label: 'Available',
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
