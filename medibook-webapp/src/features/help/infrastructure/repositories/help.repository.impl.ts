import { attempt } from '@/core/error/attempt';

import type { HelpRepository } from '@/features/help/domain/repositories/help.repository';
import { postSupportTicket } from '@/features/help/infrastructure/data-sources/remote/help.api';
import { toRaiseTicketRequest } from '@/features/help/infrastructure/data-sources/remote/help.request';
import { toSupportTicket } from '@/features/help/infrastructure/data-sources/remote/help.response';

export const helpRepository: HelpRepository = {
  raiseTicket: (input) =>
    attempt(async () => toSupportTicket(await postSupportTicket(toRaiseTicketRequest(input)))),
};
