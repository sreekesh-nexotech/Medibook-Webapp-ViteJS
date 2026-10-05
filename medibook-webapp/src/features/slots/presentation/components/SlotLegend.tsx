import type {
  SlotCellState,
  SlotCounts,
} from '@/features/slots/presentation/components/slotsGridView';
import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/Icon';

import { SLOT_STATE_STYLE } from './slotStateStyle';

/** Legend in reading order. */
const LEGEND_ORDER: readonly SlotCellState[] = ['available', 'held', 'booked', 'blocked', 'past'];

interface SlotLegendProps {
  counts: SlotCounts;
}

/** What the slot colours mean, with the day's tally beside each. */
export function SlotLegend({ counts }: SlotLegendProps) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {LEGEND_ORDER.map((state) => {
        const style = SLOT_STATE_STYLE[state];
        return (
          <span
            key={state}
            className={cn(
              'text-caption inline-flex items-center gap-1.5 rounded-full border px-3 py-1.25 font-medium',
              style.box,
            )}
          >
            <Icon name={style.icon} size={13} /> {style.label}
            <span className="tabular-nums">{counts[state]}</span>
          </span>
        );
      })}
    </div>
  );
}
