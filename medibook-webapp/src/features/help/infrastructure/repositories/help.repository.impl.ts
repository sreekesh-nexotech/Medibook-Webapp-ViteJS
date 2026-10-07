import { attempt } from '@/core/error/attempt';
import { isFailure } from '@/core/error/failure';
import { toFailure } from '@/core/error/toFailure';

import type { HelpRepository } from '@/features/help/domain/repositories/help.repository';
import {
  getHospitalFaqs,
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
  toHelpFaqs,
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
  listFaqs: () =>
    attempt(async () => {
      try {
        return toHelpFaqs(await getHospitalFaqs());
      } catch (error) {
        // A backend without the feed answers 404: the screen keeps its own answers.
        const failure = isFailure(error) ? error : toFailure(error);
        if (failure.kind === 'notFound') return [];
        throw failure;
      }
    }),
  addMessage: (id, input) =>
    attempt(async () =>
      toTicketMessage(await postTicketMessage(id, toTicketMessageRequest(input))),
    ),
};
