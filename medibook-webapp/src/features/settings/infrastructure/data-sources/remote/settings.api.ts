import { ifMatch } from '@/core/api/headers';
import { hospitalApi } from '@/core/api/http';
import { fetchAllPages } from '@/core/api/pagination';

import type {
  BankAccountWriteRequest,
  HospitalProfilePatchRequest,
  HospitalSettingsPutRequest,
  ScheduleHoursPutRequest,
  TokenPolicyPutRequest,
} from '@/features/settings/infrastructure/data-sources/remote/settings.request';
import type {
  BankAccountResponse,
  HospitalProfileResponse,
  HospitalSettingsResponse,
  ScheduleHoursListResponse,
  TokenPolicyResponse,
} from '@/features/settings/infrastructure/data-sources/remote/settings.response';
import {
  bankAccountPageResponseSchema,
  bankAccountResponseSchema,
  hospitalProfileResponseSchema,
  hospitalSettingsResponseSchema,
  scheduleHoursListResponseSchema,
  tokenPolicyResponseSchema,
} from '@/features/settings/infrastructure/data-sources/remote/settings.response';

/** Hospital Settings endpoints (`/api/v1/hospital/…`). Every body is Zod-validated. */

const PROFILE_PATH = '/profile';
const SETTINGS_PATH = '/settings';
const HOURS_PATH = '/hours';
const TOKEN_POLICY_PATH = '/token-policy';
const BANK_ACCOUNTS_PATH = '/billing/bank-accounts';

export async function getProfile(): Promise<HospitalProfileResponse> {
  const response = await hospitalApi.get(PROFILE_PATH);
  return hospitalProfileResponseSchema.parse(response.data);
}

export async function patchProfile(
  body: HospitalProfilePatchRequest,
  version: number,
): Promise<HospitalProfileResponse> {
  const response = await hospitalApi.patch(PROFILE_PATH, body, { headers: ifMatch(version) });
  return hospitalProfileResponseSchema.parse(response.data);
}

export async function getSettings(): Promise<HospitalSettingsResponse> {
  const response = await hospitalApi.get(SETTINGS_PATH);
  return hospitalSettingsResponseSchema.parse(response.data);
}

export async function putSettings(
  body: HospitalSettingsPutRequest,
  version: number,
): Promise<HospitalSettingsResponse> {
  const response = await hospitalApi.put(SETTINGS_PATH, body, { headers: ifMatch(version) });
  return hospitalSettingsResponseSchema.parse(response.data);
}

export async function getHours(): Promise<ScheduleHoursListResponse> {
  const response = await hospitalApi.get(HOURS_PATH);
  return scheduleHoursListResponseSchema.parse(response.data);
}

/** No `If-Match`: `hospital_hours` has no version column. */
export async function putHours(body: ScheduleHoursPutRequest): Promise<ScheduleHoursListResponse> {
  const response = await hospitalApi.put(HOURS_PATH, body);
  return scheduleHoursListResponseSchema.parse(response.data);
}

export async function getTokenPolicy(): Promise<TokenPolicyResponse> {
  const response = await hospitalApi.get(TOKEN_POLICY_PATH);
  return tokenPolicyResponseSchema.parse(response.data);
}

/** `scope`/`reset` apply from tomorrow (sent equal to the value in force, they cancel a pending change). */
export async function putTokenPolicy(
  body: TokenPolicyPutRequest,
  version: number,
): Promise<TokenPolicyResponse> {
  const response = await hospitalApi.put(TOKEN_POLICY_PATH, body, { headers: ifMatch(version) });
  return tokenPolicyResponseSchema.parse(response.data);
}

export async function listBankAccounts(): Promise<readonly BankAccountResponse[]> {
  return fetchAllPages(async (params) => {
    const response = await hospitalApi.get(BANK_ACCOUNTS_PATH, { params });
    return bankAccountPageResponseSchema.parse(response.data);
  });
}

export async function postBankAccount(body: BankAccountWriteRequest): Promise<BankAccountResponse> {
  const response = await hospitalApi.post(BANK_ACCOUNTS_PATH, body);
  return bankAccountResponseSchema.parse(response.data);
}

/** Soft delete; `If-Match` honoured when sent. */
export async function deleteBankAccount(id: string, version: number): Promise<void> {
  await hospitalApi.delete(`${BANK_ACCOUNTS_PATH}/${encodeURIComponent(id)}`, {
    headers: ifMatch(version),
  });
}

/** One primary per hospital; payouts go to it (admin role only, decision 4). */
export async function postBankAccountPrimary(id: string): Promise<BankAccountResponse> {
  const response = await hospitalApi.post(
    `${BANK_ACCOUNTS_PATH}/${encodeURIComponent(id)}/primary`,
  );
  return bankAccountResponseSchema.parse(response.data);
}

export async function patchBankAccount(
  id: string,
  body: BankAccountWriteRequest,
  version: number,
): Promise<BankAccountResponse> {
  const response = await hospitalApi.patch(
    `${BANK_ACCOUNTS_PATH}/${encodeURIComponent(id)}`,
    body,
    {
      headers: ifMatch(version),
    },
  );
  return bankAccountResponseSchema.parse(response.data);
}
