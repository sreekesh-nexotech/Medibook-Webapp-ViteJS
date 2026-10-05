import type { Result } from '@/core/error/failure';

import { servicesRepository } from '@/features/settings/infrastructure/repositories/services.repository.impl';

export function deleteService(id: string): Promise<Result<null>> {
  return servicesRepository.deleteService(id);
}
