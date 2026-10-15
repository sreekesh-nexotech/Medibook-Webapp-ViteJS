import { getFileUrl, uploadFile } from '@/core/api/files.api';
import { attempt } from '@/core/error/attempt';
import type { Result } from '@/core/error/failure';
import { ok } from '@/core/error/failure';

import type { SettingsRepository } from '@/features/settings/domain/repositories/settings.repository';
import {
  deleteBankAccount,
  getHours,
  getProfile,
  getSettings,
  getTokenPolicy,
  listBankAccounts,
  patchBankAccount,
  patchProfile,
  postBankAccount,
  postBankAccountPrimary,
  putHours,
  putSettings,
  putTokenPolicy,
} from '@/features/settings/infrastructure/data-sources/remote/settings.api';
import {
  toBankAccountWriteRequest,
  toHoursPutRequest,
  toProfilePatchRequest,
  toSettingsPutRequest,
  toTokenPolicyPutRequest,
} from '@/features/settings/infrastructure/data-sources/remote/settings.request';
import {
  toBankAccount,
  toHospitalHours,
  toHospitalProfile,
  toHospitalRuleSettings,
  toTokenPolicy,
} from '@/features/settings/infrastructure/data-sources/remote/settings.response';

export const settingsRepository: SettingsRepository = {
  getProfile: () => attempt(async () => toHospitalProfile(await getProfile())),

  updateProfile: (changes, version) =>
    attempt(async () =>
      toHospitalProfile(await patchProfile(toProfilePatchRequest(changes), version)),
    ),

  getRuleSettings: () => attempt(async () => toHospitalRuleSettings(await getSettings())),

  updateRuleSettings: (changes, version) =>
    attempt(async () =>
      toHospitalRuleSettings(await putSettings(toSettingsPutRequest(changes), version)),
    ),

  getHours: () => attempt(async () => toHospitalHours(await getHours())),

  replaceHours: (days) =>
    attempt(async () => toHospitalHours(await putHours(toHoursPutRequest(days)))),

  getTokenPolicy: () => attempt(async () => toTokenPolicy(await getTokenPolicy())),

  updateTokenPolicy: (changes, version) =>
    attempt(async () =>
      toTokenPolicy(await putTokenPolicy(toTokenPolicyPutRequest(changes), version)),
    ),

  listBankAccounts: () => attempt(async () => (await listBankAccounts()).map(toBankAccount)),

  createBankAccount: (input) =>
    attempt(async () => toBankAccount(await postBankAccount(toBankAccountWriteRequest(input)))),

  updateBankAccount: (id, input, version) =>
    attempt(async () =>
      toBankAccount(await patchBankAccount(id, toBankAccountWriteRequest(input), version)),
    ),

  deleteBankAccount: (id, version) =>
    attempt(async () => {
      await deleteBankAccount(id, version);
      return null;
    }),

  makeBankAccountPrimary: (id) =>
    attempt(async () => toBankAccount(await postBankAccountPrimary(id))),

  uploadImage: async (file, purpose): Promise<Result<string>> => {
    const uploaded = await uploadFile({ file, purpose });
    return uploaded.ok ? ok(uploaded.data.id) : uploaded;
  },

  getImageUrl: async (fileId): Promise<Result<string>> => {
    const signed = await getFileUrl(fileId);
    return signed.ok ? ok(signed.data.url) : signed;
  },
};
