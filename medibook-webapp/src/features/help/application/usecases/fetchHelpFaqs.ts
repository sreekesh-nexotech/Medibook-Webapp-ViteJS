import type { Result } from '@/core/error/failure';

import type { HelpFaq } from '@/features/help/domain/entities/help.types';
import { helpRepository } from '@/features/help/infrastructure/repositories/help.repository.impl';

export function fetchHelpFaqs(): Promise<Result<readonly HelpFaq[]>> {
  return helpRepository.listFaqs();
}
