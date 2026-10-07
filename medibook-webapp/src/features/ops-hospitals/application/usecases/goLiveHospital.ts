import type { Failure, Result } from '@/core/error/failure';
import { ok } from '@/core/error/failure';

import type { GoLiveFlags } from '@/features/ops-hospitals/domain/entities/onboarding.entity';
import { openHospitalToPatients } from '@/features/ops-hospitals/application/usecases/openHospitalToPatients';
import { onboardingRepository } from '@/features/ops-hospitals/infrastructure/repositories/onboarding.repository.impl';

/** How go-live went for the patient app. */
export interface GoLiveOutcome {
  /** Listed in the app with online booking on. */
  readonly isOpenToPatients: boolean;
  /** Set when the hospital went live but could not be opened to patients. */
  readonly openFailure: Failure | null;
}

/**
 * Take a hospital live, opening it to patients in the same call when asked
 * (CORE-03-B). An older backend ignores the flags and answers with the
 * hospital still hidden; then the two follow-up calls it needs are made, so
 * the result is the same either way.
 */
export async function goLiveHospital(
  hospitalId: string,
  flags: GoLiveFlags | null,
): Promise<Result<GoLiveOutcome>> {
  const live = await onboardingRepository.goLive(hospitalId, flags);
  if (!live.ok) return live;
  const wantsOpen =
    flags !== null && flags.appVisibility === 'visible' && flags.onlineBookingEnabled;
  if (!wantsOpen) return ok({ isOpenToPatients: false, openFailure: null });
  const isApplied =
    live.data.appVisibility === 'visible' && live.data.onlineBookingEnabled === true;
  if (isApplied) return ok({ isOpenToPatients: true, openFailure: null });
  const opened = await openHospitalToPatients(hospitalId);
  return ok(
    opened.ok
      ? { isOpenToPatients: true, openFailure: null }
      : { isOpenToPatients: false, openFailure: opened.failure },
  );
}
