import { uploadFile } from '@/core/api/files.api';
import { attempt } from '@/core/error/attempt';
import type { Result } from '@/core/error/failure';
import { ok } from '@/core/error/failure';

import type { OnboardingRepository } from '@/features/ops-hospitals/domain/repositories/onboarding.repository';
import {
  getCase,
  listCases,
  listRequirements,
  patchCase,
  patchChecklistItem,
  postApprove,
  postGoLive,
} from '@/features/ops-hospitals/infrastructure/data-sources/remote/onboarding.api';
import {
  toCaseDetail,
  toChecklistItem,
  toPipeline,
  toRequirements,
} from '@/features/ops-hospitals/infrastructure/data-sources/remote/onboarding.response';

const REJECTED_STAGE = 'rejected';

export const onboardingRepository: OnboardingRepository = {
  listCases: (query) => attempt(async () => toPipeline(await listCases(query))),

  getCase: (caseId) => attempt(async () => toCaseDetail(await getCase(caseId))),

  setStage: (caseId, stage, version) =>
    attempt(async () => toCaseDetail(await patchCase(caseId, { stage }, version))),

  rejectCase: (caseId, reason, version) =>
    attempt(async () =>
      toCaseDetail(
        await patchCase(caseId, { stage: REJECTED_STAGE, rejection_reason: reason }, version),
      ),
    ),

  updateCase: (caseId, changes, version) =>
    attempt(async () =>
      toCaseDetail(
        await patchCase(
          caseId,
          {
            ...(changes.notes !== undefined && { notes: changes.notes }),
            ...(changes.assignedToId !== undefined && { assigned_to_id: changes.assignedToId }),
          },
          version,
        ),
      ),
    ),

  updateChecklistItem: (caseId, code, update, version) =>
    attempt(async () =>
      toChecklistItem(
        await patchChecklistItem(
          caseId,
          code,
          {
            ...(update.status !== undefined && { status: update.status }),
            ...(update.note !== undefined && { note: update.note }),
            ...(update.fileId !== undefined && { file_id: update.fileId }),
          },
          version,
        ),
      ),
    ),

  listDocumentRequirements: () => attempt(async () => toRequirements(await listRequirements())),

  uploadScan: async (file): Promise<Result<string>> => {
    const uploaded = await uploadFile({ file, purpose: 'kyc' });
    return uploaded.ok ? ok(uploaded.data.id) : uploaded;
  },

  approveHospital: (hospitalId) =>
    attempt(async () => {
      await postApprove(hospitalId);
      return null;
    }),

  goLive: (hospitalId, flags) =>
    attempt(async () => {
      const hospital = await postGoLive(hospitalId, flags);
      return {
        appVisibility: hospital.app_visibility ?? null,
        onlineBookingEnabled: hospital.online_booking_enabled ?? null,
      };
    }),
};
