import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { refreshTickets } from '@/features/help/application/queries/help.cache';
import { helpKeys } from '@/features/help/application/queries/help.keys';

describe('refreshTickets', () => {
  it('re-reads the ticket lists and the threads already opened, not the FAQs', async () => {
    const client = new QueryClient();
    const list = helpKeys.ticketList({ status: null, page: 1, pageSize: 10 });
    client.setQueryData(list, { items: [] });
    client.setQueryData(helpKeys.ticket('t1'), { id: 't1', messages: [] });
    client.setQueryData(helpKeys.faqs(), []);
    await refreshTickets(client);
    expect(client.getQueryState(list)?.isInvalidated).toBe(true);
    expect(client.getQueryState(helpKeys.ticket('t1'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(helpKeys.faqs())?.isInvalidated).toBe(false);
  });
});
