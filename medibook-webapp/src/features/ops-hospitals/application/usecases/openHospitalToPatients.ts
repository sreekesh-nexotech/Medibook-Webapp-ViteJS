import type { Result } from '@/core/error/failure';

import type { PlatformHospital } from '@/features/ops-hospitals/domain/entities/hospitals.entity';
import { hospitalsRepository } from '@/features/ops-hospitals/infrastructure/repositories/hospitals.repository.impl';

/**
 * List the hospital in the patient app, then switch on online booking — go-live
 * changes only the lifecycle status, and patients can book a hospital only when
 * it is active, visible and has online booking on. Listing answers with the
 * current `version`, which guards the booking change (`If-Match`).
 */
export async function openHospitalToPatients(id: string): Promise<Result<PlatformHospital>> {
  const listed = await hospitalsRepository.setVisibility(id, 'visible');
  if (!listed.ok || listed.data.onlineBookingEnabled) return listed;
  return hospitalsRepository.updateHospital(
    id,
    { onlineBookingEnabled: true },
    listed.data.version,
  );
}
