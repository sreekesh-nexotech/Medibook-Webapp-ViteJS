import { attempt } from '@/core/error/attempt';

import type { HelpRepository } from '@/features/help/domain/repositories/help.repository';
import {
  getSupportTicket,
  getSupportTickets,
  postSupportTicket,
  postTicketMessage,
} from '@/features/help/infrastructure/data-sources/remote/help.api';
import {
  toRaiseTicketRequest,
  toTicketListParams,
  toTicketMessageRequest,
} from '@/features/help/infrastructure/data-sources/remote/help.request';
import {
  toSupportTicket,
  toSupportTicketDetail,
  toTicketMessage,
} from '@/features/help/infrastructure/data-sources/remote/help.response';

export const helpRepository: HelpRepository = {
  raiseTicket: (input) =>
    attempt(async () => toSupportTicket(await postSupportTicket(toRaiseTicketRequest(input)))),
  listTickets: (query) =>
    attempt(async () => {
      const dto = await getSupportTickets(toTicketListParams(query));
      return {
        items: dto.results.map(toSupportTicket),
        page: dto.page,
        pageSize: dto.page_size,
        total: dto.total,
      };
    }),
  getTicket: (id) => attempt(async () => toSupportTicketDetail(await getSupportTicket(id))),
  addMessage: (id, input) =>
    attempt(async () =>
      toTicketMessage(await postTicketMessage(id, toTicketMessageRequest(input))),
    ),
};
