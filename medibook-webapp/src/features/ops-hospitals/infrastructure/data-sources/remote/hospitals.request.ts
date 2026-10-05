import type { HospitalCreateInput } from '@/features/ops-hospitals/domain/entities/hospitals.entity';

/** `POST /platform/hospitals` body (`PlatformHospitalCreateRequest`). */
export interface HospitalCreateRequest {
  readonly slug: string;
  readonly name: string;
  readonly email: string;
  readonly phone_e164: string;
  readonly address_line1: string;
  readonly city: string;
  readonly state: string;
  readonly pincode: string;
  readonly commission_bp: number;
  readonly convenience_fee_kind: string;
  readonly convenience_fee_value: number;
  readonly numbering: Readonly<Record<'mrn' | 'booking' | 'receipt', NumberingSpecRequest>>;
  readonly plan_id: string;
  readonly billing_period: string;
  readonly first_admin: {
    readonly email: string;
    readonly first_name: string;
    readonly last_name: string | null;
    readonly phone_e164: string | null;
  };
}

interface NumberingSpecRequest {
  readonly format: string;
  readonly prefix: string;
}

export function toHospitalCreateRequest(input: HospitalCreateInput): HospitalCreateRequest {
  return {
    slug: input.slug,
    name: input.name,
    email: input.email,
    phone_e164: input.phoneE164,
    address_line1: input.addressLine1,
    city: input.city,
    state: input.state,
    pincode: input.pincode,
    commission_bp: input.commissionBp,
    convenience_fee_kind: input.convenienceFeeKind,
    convenience_fee_value: input.convenienceFeeValue,
    numbering: {
      mrn: { ...input.numbering.mrn },
      booking: { ...input.numbering.booking },
      receipt: { ...input.numbering.receipt },
    },
    plan_id: input.planId,
    billing_period: input.billingPeriod,
    first_admin: {
      email: input.firstAdmin.email,
      first_name: input.firstAdmin.firstName,
      last_name: input.firstAdmin.lastName,
      phone_e164: input.firstAdmin.phoneE164,
    },
  };
}
