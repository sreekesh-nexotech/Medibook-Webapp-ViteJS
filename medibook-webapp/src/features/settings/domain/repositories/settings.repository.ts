import type { Result } from '@/core/error/failure';

import type {
  BankAccount,
  BankAccountInput,
  HospitalHoursDay,
  HospitalImagePurpose,
  HospitalProfile,
  HospitalProfileChanges,
  HospitalRuleChanges,
  HospitalRuleSettings,
  TokenPolicy,
  TokenScope,
} from '@/features/settings/domain/entities/settings.entities';

/** Hospital Settings (H2): profile, rules, hours, token policy and payout account. */
export interface SettingsRepository {
  getProfile(): Promise<Result<HospitalProfile>>;
  /** Patch the profile; `version` guards against a concurrent edit. */
  updateProfile(changes: HospitalProfileChanges, version: number): Promise<Result<HospitalProfile>>;

  getRuleSettings(): Promise<Result<HospitalRuleSettings>>;
  updateRuleSettings(
    changes: HospitalRuleChanges,
    version: number,
  ): Promise<Result<HospitalRuleSettings>>;

  getHours(): Promise<Result<readonly HospitalHoursDay[]>>;
  /** Replace the whole week — exactly one entry per weekday 0..6. */
  replaceHours(days: readonly HospitalHoursDay[]): Promise<Result<readonly HospitalHoursDay[]>>;

  getTokenPolicy(): Promise<Result<TokenPolicy>>;
  /** Scope changes apply from tomorrow (hospital-local). */
  updateTokenScope(scope: TokenScope, version: number): Promise<Result<TokenPolicy>>;

  listBankAccounts(): Promise<Result<readonly BankAccount[]>>;
  createBankAccount(input: BankAccountInput): Promise<Result<BankAccount>>;
  updateBankAccount(
    id: string,
    input: BankAccountInput,
    version: number,
  ): Promise<Result<BankAccount>>;

  /** Upload a hospital image; resolves to the stored file id to attach to the profile. */
  uploadImage(file: File, purpose: HospitalImagePurpose): Promise<Result<string>>;
  /** A short-lived signed URL to display a stored image. */
  getImageUrl(fileId: string): Promise<Result<string>>;
}
