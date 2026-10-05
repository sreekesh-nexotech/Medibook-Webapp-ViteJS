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
  listCases: () => attempt(async () => toPipeline(await listCases())),

  getCase: (caseId) => attempt(async () => toCaseDetail(await getCase(caseId))),

  setStage: (caseId, stage) =>
    attempt(async () => toCaseDetail(await patchCase(caseId, { stage }))),

  rejectCase: (caseId, reason) =>
    attempt(async () =>
      toCaseDetail(await patchCase(caseId, { stage: REJECTED_STAGE, rejection_reason: reason })),
    ),

  updateChecklistItem: (caseId, code, update) =>
    attempt(async () =>
      toChecklistItem(
        await patchChecklistItem(caseId, code, {
          status: update.status,
          ...(update.note !== undefined && { note: update.note }),
          ...(update.fileId !== undefined && { file_id: update.fileId }),
        }),
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

  goLive: (hospitalId) =>
    attempt(async () => {
      await postGoLive(hospitalId);
      return null;
    }),
};
