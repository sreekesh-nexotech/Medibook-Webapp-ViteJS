import type { Result } from '@/core/error/failure';

import type {
  NumberingChange,
  NumberingKind,
  NumberingSeries,
  TokenPolicy,
  TokenPolicyChange,
} from '@/features/ops-hospitals/domain/entities/hospitalSettings.entity';

/** Platform overrides of one hospital's numbering series and token policy. */
export interface HospitalSettingsRepository {
  getNumbering(hospitalId: string, kind: NumberingKind): Promise<Result<NumberingSeries>>;
  updateNumbering(
    hospitalId: string,
    kind: NumberingKind,
    change: NumberingChange,
    version: number,
  ): Promise<Result<NumberingSeries>>;
  getTokenPolicy(hospitalId: string): Promise<Result<TokenPolicy>>;
  updateTokenPolicy(
    hospitalId: string,
    change: TokenPolicyChange,
    version: number,
  ): Promise<Result<TokenPolicy>>;
}
