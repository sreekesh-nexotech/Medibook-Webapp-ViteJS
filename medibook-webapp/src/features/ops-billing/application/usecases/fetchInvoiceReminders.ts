import type { Result } from '@/core/error/failure';

import type { DunningEvent } from '@/features/ops-billing/domain/entities/billing.entities';
import { billingRepository } from '@/features/ops-billing/infrastructure/repositories/billing.repository.impl';

export function fetchInvoiceReminders(invoiceId: string): Promise<Result<readonly DunningEvent[]>> {
  return billingRepository.listReminderEvents(invoiceId);
}
