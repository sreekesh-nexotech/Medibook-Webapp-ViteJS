import type { SlotCounts, SlotState } from '@/features/slots/domain/slot';
import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/Icon';

import { SLOT_STATE_STYLE } from './slotStateStyle';

/** Legend order, worst-to-best is not useful here — this is reading order. */
const LEGEND_ORDER: readonly SlotState[] = ['available', 'booked', 'blocked', 'past'];

interface SlotLegendProps {
  counts: SlotCounts;
}

/** What the four slot colours mean, with today's tally beside each. */
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
