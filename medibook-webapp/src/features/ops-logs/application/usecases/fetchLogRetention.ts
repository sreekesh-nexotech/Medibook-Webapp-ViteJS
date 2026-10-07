import type { Result } from '@/core/error/failure';

import type { RetentionWindow } from '@/features/ops-logs/domain/entities/logs.types';
import { logsRepository } from '@/features/ops-logs/infrastructure/repositories/logs.repository.impl';

export function fetchLogRetention(): Promise<Result<RetentionWindow[]>> {
  return logsRepository.getRetention();
}
