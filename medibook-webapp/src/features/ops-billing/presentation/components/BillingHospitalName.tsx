import { useHospitalQuery } from '@/features/ops-hospitals/application/queries/useHospitalQuery';

interface BillingHospitalNameProps {
  hospitalId: string;
}

/**
 * A hospital's name for rows whose API record carries only its id (payments,
 * plan-change requests). Read through P2's hospital query, so each hospital is
 * fetched once and shared across rows and screens.
 */
export function BillingHospitalName({ hospitalId }: BillingHospitalNameProps) {
  const hospital = useHospitalQuery(hospitalId);
  if (hospital.isPending) return <span className="text-text-muted">Loading…</span>;
  return <>{hospital.data?.name ?? 'Unknown hospital'}</>;
}
