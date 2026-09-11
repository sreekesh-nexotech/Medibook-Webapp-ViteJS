import { useState } from 'react';

import { cn } from '@/shared/lib/cn';
import { Card } from '@/shared/ui/Card';
import { SectionTitle } from '@/shared/ui/SectionTitle';

/** Last-7-days booking totals (design `week`), capped at `WMAX` for the bars. */
const WEEK: readonly (readonly [string, number])[] = [
  ['Mon', 1240],
  ['Tue', 1420],
  ['Wed', 1180],
  ['Thu', 1660],
  ['Fri', 1842],
  ['Sat', 980],
  ['Sun', 760],
];

const WMAX = 2000;

/**
 * "Booking Usage" bar chart — the prototype's custom inline bars (not the
 * shared BarChart), with a JS-driven hover tooltip and bar-color swap.
 */
export function BookingUsageCard() {
  const [hover, setHover] = useState<number | null>(null);
  return (
    <Card>
      <div className="mb-4.5 flex items-baseline justify-between">
        <SectionTitle>Booking Usage</SectionTitle>
        <span className="text-caption text-text-muted">Last 7 days</span>
      </div>
      <div className="flex h-52.5 items-end gap-4.5 px-1">
        {WEEK.map(([d, v], i) => (
          <div
            key={d}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className="relative flex h-full flex-1 cursor-default flex-col items-center justify-end gap-2"
          >
            {hover === i && (
              <span
                className="bg-text-strong text-caption pointer-events-none absolute z-[5] rounded-sm px-2.5 py-1 whitespace-nowrap text-white"
                style={{ bottom: `calc(${(v / WMAX) * 100}% + 34px)` }}
              >
                {v.toLocaleString('en-IN')} bookings
              </span>
            )}
            <span className="text-caption text-text-muted font-semibold tabular-nums">
              {v.toLocaleString('en-IN')}
            </span>
            <div
              className={cn(
                'min-h-1 w-[72%] max-w-10.5 rounded-t-[6px] transition-colors duration-150',
                hover === i ? 'bg-p-600' : 'bg-p-500',
              )}
              style={{ height: `${(v / WMAX) * 100}%` }}
            />
            <span className="text-caption text-text-muted">{d}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
