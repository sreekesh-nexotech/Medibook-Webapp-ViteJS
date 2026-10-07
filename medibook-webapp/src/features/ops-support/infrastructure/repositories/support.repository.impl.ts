import { toPage } from '@/core/api/pagination';
import { attempt } from '@/core/error/attempt';

import type { SupportRepository } from '@/features/ops-support/domain/repositories/support.repository';
import {
  getTicket,
  getTickets,
  patchTicket,
  postTicketMessage,
} from '@/features/ops-support/infrastructure/data-sources/remote/support.api';
import {
  toSupportTicket,
  toSupportTicketDetail,
  toTicketMessage,
} from '@/features/ops-support/infrastructure/data-sources/remote/support.response';

export const supportRepository: SupportRepository = {
  listTickets: (query) => attempt(async () => toPage(await getTickets(query), toSupportTicket)),
  getTicket: (id) => attempt(async () => toSupportTicketDetail(await getTicket(id))),
  updateTicket: (id, changes, version) =>
    attempt(async () => toSupportTicketDetail(await patchTicket(id, changes, version))),
  reply: (id, reply) => attempt(async () => toTicketMessage(await postTicketMessage(id, reply))),
};
