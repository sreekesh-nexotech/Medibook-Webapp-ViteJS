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
  NumberingChanges,
  NumberingKind,
  NumberingSeries,
  TokenPolicy,
  TokenPolicyChanges,
} from '@/features/settings/domain/entities/settings.entities';

/** Hospital Settings (H2): profile, rules, hours, token policy, numbering and payout account. */
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
  /** Scope and reset changes apply from tomorrow (hospital-local); the rest at once. */
  updateTokenPolicy(changes: TokenPolicyChanges, version: number): Promise<Result<TokenPolicy>>;

  /** The MRN, booking and receipt number series. */
  listNumbering(): Promise<Result<readonly NumberingSeries[]>>;
  /** A new format applies to numbers issued from now on; issued numbers never change. */
  updateNumbering(
    kind: NumberingKind,
    changes: NumberingChanges,
    version: number,
  ): Promise<Result<NumberingSeries>>;

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
