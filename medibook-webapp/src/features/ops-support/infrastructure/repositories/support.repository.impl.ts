import { getFileUrl } from '@/core/api/files.api';
import { toPage } from '@/core/api/pagination';
import { attempt } from '@/core/error/attempt';
import { unwrap } from '@/core/error/failure';

import type { SupportRepository } from '@/features/ops-support/domain/repositories/support.repository';
import {
  getTicket,
  getTickets,
  patchTicket,
  postTicketMessage,
} from '@/features/ops-support/infrastructure/data-sources/remote/support.api';
import {
  toTicketListQuery,
  toTicketMessageRequest,
  toTicketUpdateRequest,
} from '@/features/ops-support/infrastructure/data-sources/remote/support.request';
import {
  toSupportTicket,
  toSupportTicketDetail,
  toTicketMessage,
} from '@/features/ops-support/infrastructure/data-sources/remote/support.response';

/** A count needs only the page's `total`, so ask for the smallest page. */
const COUNT_PAGE_SIZE = 1;

export const supportRepository: SupportRepository = {
  listTickets: (query) =>
    attempt(async () => {
      const q =
        'ticketNo' in query &&
        typeof query.ticketNo === 'string' &&
        'sort' in query &&
        typeof query.sort === 'string'
          ? toTicketListQuery(query as any)
          : (query as any);
      return toPage(await getTickets(q), toSupportTicket);
    }),

  countTickets: (statuses) =>
    attempt(async () => {
      const page = await getTickets({
        page: 1,
        page_size: COUNT_PAGE_SIZE,
        sort: '-created_at',
        ...(statuses.length > 0 ? { status: statuses.join(',') } : {}),
      });
      return page.total;
    }),

  getTicket: (id) => attempt(async () => toSupportTicketDetail(await getTicket(id))),

  updateTicket: (id, changes, version) =>
    attempt(async () =>
      toSupportTicketDetail(await patchTicket(id, toTicketUpdateRequest(changes), version)),
    ),

  reply: (id, reply) => attempt(async () => toTicketMessage(await postTicketMessage(id, reply))),

  replyToTicket: (id, reply) =>
    attempt(async () =>
      toTicketMessage(await postTicketMessage(id, toTicketMessageRequest(reply))),
    ),

  attachmentUrl: (fileId) => attempt(async () => unwrap(await getFileUrl(fileId)).url),
};
