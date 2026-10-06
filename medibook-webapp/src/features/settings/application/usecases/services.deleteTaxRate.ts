import type { Result } from '@/core/error/failure';

import { servicesRepository } from '@/features/settings/infrastructure/repositories/services.repository.impl';

export function deleteTaxRate(id: string, version: number): Promise<Result<null>> {
  return servicesRepository.deleteTaxRate(id, version);
}
