import type { Result } from '@/core/error/failure';

import { appointmentsRepository } from '@/features/appointments/infrastructure/repositories/appointments.repository.impl';

export function fetchReceiptPdfUrl(id: string): Promise<Result<string>> {
  return appointmentsRepository.receiptPdfUrl(id);
}
