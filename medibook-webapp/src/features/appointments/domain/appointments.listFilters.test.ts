import { describe, expect, it } from 'vitest';

import {
  combineFilters,
  TAB_FILTERS,
  tabFromSlug,
} from '@/features/appointments/domain/appointments.listFilters';

describe('desk list tabs and status filter → server filter', () => {
  it('uses the tab alone when no status is chosen', () => {
    expect(combineFilters('Online', null)).toEqual(TAB_FILTERS.Online);
    expect(combineFilters('All', null)).toEqual({
      statuses: [],
      source: null,
      paymentStatus: null,
    });
  });

  it('narrows a status-free tab to the chosen statuses', () => {
    expect(combineFilters('Walk-in', 'In Queue')).toEqual({
      statuses: ['checked_in', 'in_consultation'],
      source: 'walk_in',
      paymentStatus: null,
    });
  });

  it('intersects a tab’s own statuses with the chosen ones', () => {
    expect(combineFilters('Pending Payment', 'Scheduled')).toEqual({
      statuses: ['scheduled'],
      source: 'walk_in',
      paymentStatus: 'unpaid',
    });
  });

  it('answers null when the tab and the status can never both hold', () => {
    expect(combineFilters('Needs Approval', 'Completed')).toBeNull();
    expect(combineFilters('In Queue', 'Cancelled')).toBeNull();
  });

  it('reads tab slugs from links, defaulting to All', () => {
    expect(tabFromSlug('pending-payment')).toBe('Pending Payment');
    expect(tabFromSlug('needs-approval')).toBe('Needs Approval');
    expect(tabFromSlug('nonsense')).toBe('All');
    expect(tabFromSlug(null)).toBe('All');
  });
});
